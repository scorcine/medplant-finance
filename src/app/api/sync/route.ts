import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createClient } from "redis";
import { SYNCED_KEYS, applyOp, type SyncOp } from "@/lib/sync-merge";

export const dynamic = "force-dynamic";

type SyncDoc = { version: number; updatedAt: string; keys: Record<string, string> };

const ALLOWED = new Set<string>(SYNCED_KEYS);

type RedisConfig = { kind: "rest"; url: string; token: string } | { kind: "tcp"; url: string };

function redisConfig(): RedisConfig | null {
  const names = Object.keys(process.env);
  for (const urlName of names.filter((name) => /(KV_REST_API_URL|UPSTASH_REDIS_REST_URL)$/.test(name))) {
    const url = process.env[urlName];
    const token = process.env[urlName.replace(/URL$/, "TOKEN")];
    if (url && token) return { kind: "rest", url, token };
  }
  const tcpName = names.find((name) => /(^|_)(REDIS_URL|KV_URL)$/.test(name) && /^rediss?:\/\//.test(process.env[name] ?? ""));
  return tcpName ? { kind: "tcp", url: process.env[tcpName] as string } : null;
}

async function redis(config: RedisConfig, command: string[]) {
  if (config.kind === "tcp") {
    const client = createClient({ url: config.url });
    await client.connect();
    try {
      return await client.sendCommand(command);
    } finally {
      await client.quit();
    }
  }
  const response = await fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const json = (await response.json()) as { result?: unknown; error?: string };
  if (!response.ok || json.error) throw new Error(json.error ?? `Redis ${response.status}`);
  return json.result;
}

function normalizeCode(raw: string | null) {
  const code = (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{20}$/.test(code) ? code : null;
}

function storageKey(code: string) {
  return `medplant:familia:${createHash("sha256").update(`id:${code}`).digest("hex")}`;
}

function cipherKey(code: string) {
  return createHash("sha256").update(`chave:${code}`).digest();
}

function encrypt(code: string, doc: SyncDoc) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cipherKey(code), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(doc), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

function decrypt(code: string, payload: string): SyncDoc {
  const raw = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", cipherKey(code), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  const text = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  return JSON.parse(text) as SyncDoc;
}

export function GET() {
  const config = redisConfig();
  return Response.json({ ready: Boolean(config), kind: config?.kind });
}

export async function POST(request: Request) {
  const config = redisConfig();
  if (!config) {
    return Response.json(
      { error: "A sincronização ainda não foi ativada no servidor.", code: "sem-banco" },
      { status: 503 },
    );
  }

  const code = normalizeCode(request.headers.get("x-sync-code"));
  if (!code) return Response.json({ error: "Código da família inválido." }, { status: 400 });

  let body: { changes?: Record<string, SyncOp>; create?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Pedido inválido." }, { status: 400 });
  }

  try {
    const key = storageKey(code);
    const stored = (await redis(config, ["GET", key])) as string | null;
    let doc = stored ? decrypt(code, stored) : null;
    if (!doc && !body.create) {
      return Response.json({ error: "Código da família não encontrado.", code: "nao-encontrado" }, { status: 404 });
    }
    doc ??= { version: 0, updatedAt: new Date().toISOString(), keys: {} };

    let changed = !stored;
    for (const [name, op] of Object.entries(body.changes ?? {})) {
      if (!ALLOWED.has(name) || !op || typeof op !== "object") continue;
      const next = applyOp(doc.keys[name], op);
      if (next === doc.keys[name]) continue;
      if (next === undefined) delete doc.keys[name];
      else doc.keys[name] = next;
      changed = true;
    }

    if (changed) {
      doc = { ...doc, version: doc.version + 1, updatedAt: new Date().toISOString() };
      await redis(config, ["SET", key, encrypt(code, doc)]);
    }
    return Response.json({ version: doc.version, updatedAt: doc.updatedAt, keys: doc.keys });
  } catch {
    return Response.json({ error: "Não foi possível falar com o banco de dados." }, { status: 502 });
  }
}
