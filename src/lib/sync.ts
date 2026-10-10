import { DATA_EVENT } from "@/lib/records";
import { SYNCED_KEYS, diffValues, sameContent, type SyncOp } from "@/lib/sync-merge";

const CODE_KEY = "medplant-sync-codigo";
const BASE_KEY = "medplant-sync-base";
const LAST_KEY = "medplant-sync-ultima";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const DEVICE_KEY = "medplant-aparelho";
const OWNER_KEY = "medplant-conta";
const PEOPLE_KEY = "medplant-pessoas";

export type SyncDevice = { id: string; label: string; lastSeen: string };

export type SyncStatus = {
  state: "desligado" | "sincronizando" | "ok" | "erro" | "sem-banco";
  message: string;
  lastSync: string;
  devices: SyncDevice[];
};

type ServerDoc = {
  version: number;
  updatedAt: string;
  keys: Record<string, string>;
  devices?: Record<string, { label: string; lastSeen: string }>;
};

let status: SyncStatus = { state: "desligado", message: "", lastSync: "", devices: [] };

export function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function deviceKind() {
  const agent = navigator.userAgent;
  if (/iPhone/i.test(agent)) return "iPhone";
  if (/iPad/i.test(agent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Android/i.test(agent)) return /Mobile/i.test(agent) ? "Celular Android" : "Tablet Android";
  const browser = /Edg\//.test(agent) ? "Edge" : /Chrome\//.test(agent) ? "Chrome" : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : "";
  const system = /Windows/i.test(agent) ? "Windows" : /Mac OS/i.test(agent) ? "Mac" : "";
  return ["Computador", system, browser].filter(Boolean).join(" · ");
}

function ownerName() {
  try {
    const ownerId = localStorage.getItem(OWNER_KEY);
    const people = JSON.parse(localStorage.getItem(PEOPLE_KEY) ?? "[]") as { id: string; nome: string }[];
    return people.find((person) => person.id === ownerId)?.nome.split(" ")[0] ?? "";
  } catch {
    return "";
  }
}

function deviceLabel() {
  return [ownerName(), deviceKind()].filter(Boolean).join(" · ");
}

function devicesOf(doc: ServerDoc): SyncDevice[] {
  return Object.entries(doc.devices ?? {})
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}
const listeners = new Set<(value: SyncStatus) => void>();
let running: Promise<void> | null = null;
let again = false;
let started = false;

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  listeners.forEach((notify) => notify(status));
}

export function subscribeSync(listener: (value: SyncStatus) => void) {
  listeners.add(listener);
  listener(status);
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncCode() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(CODE_KEY) ?? "";
}

export function formatCode(code: string) {
  return code.match(/.{1,5}/g)?.join("-") ?? code;
}

export function normalizeCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

function loadBase(): Record<string, string | null> {
  try {
    const parsed = JSON.parse(localStorage.getItem(BASE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveBase(base: Record<string, string | null>) {
  localStorage.setItem(BASE_KEY, JSON.stringify(base));
}

async function request(code: string, body: { changes?: Record<string, SyncOp>; create?: boolean }) {
  const response = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-sync-code": code },
    body: JSON.stringify({ ...body, device: { id: deviceId(), label: deviceLabel() } }),
    cache: "no-store",
  });
  const json = (await response.json().catch(() => ({}))) as Partial<ServerDoc> & { error?: string; code?: string };
  if (!response.ok) {
    const error = new Error(json.error ?? "Não foi possível sincronizar.") as Error & { code?: string };
    error.code = json.code;
    throw error;
  }
  return json as ServerDoc;
}

function writeLocal(key: string, value: string | null) {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

async function runSync(create = false) {
  const code = getSyncCode();
  if (!code) return;
  const base = loadBase();
  const sent: Record<string, string | null> = {};
  const changes: Record<string, SyncOp> = {};
  for (const key of SYNCED_KEYS) {
    const local = localStorage.getItem(key);
    sent[key] = local;
    const op = diffValues(base[key] ?? null, local);
    if (op) changes[key] = op;
  }

  setStatus({ state: "sincronizando", message: "" });
  try {
    const doc = await request(code, { changes, create });
    let applied = false;
    for (const key of SYNCED_KEYS) {
      const server = doc.keys[key] ?? null;
      const current = localStorage.getItem(key);
      if (current !== sent[key]) {
        again = true;
      } else if (!sameContent(current, server)) {
        writeLocal(key, server);
        applied = true;
      }
      base[key] = server;
    }
    saveBase(base);
    const now = new Date().toISOString();
    localStorage.setItem(LAST_KEY, now);
    setStatus({ state: "ok", message: "", lastSync: now, devices: devicesOf(doc) });
    if (applied) window.dispatchEvent(new Event(DATA_EVENT));
  } catch (error) {
    const code = (error as { code?: string }).code;
    setStatus({
      state: code === "sem-banco" ? "sem-banco" : "erro",
      message: error instanceof Error ? error.message : "Não foi possível sincronizar.",
    });
    throw error;
  }
}

export function syncNow(create = false): Promise<void> {
  if (!getSyncCode()) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = runSync(create)
    .catch(() => undefined)
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        void syncNow();
      }
    });
  return running;
}

export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  setStatus({ lastSync: localStorage.getItem(LAST_KEY) ?? "" });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), 1500);
  };
  window.addEventListener(DATA_EVENT, soon);
  window.addEventListener("focus", () => void syncNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
  setInterval(() => {
    if (document.visibilityState === "visible") void syncNow();
  }, 45_000);
  void syncNow();
}

export async function createFamilySync() {
  const code = newCode();
  localStorage.setItem(CODE_KEY, code);
  saveBase({});
  try {
    await runSync(true);
  } catch (error) {
    localStorage.removeItem(CODE_KEY);
    localStorage.removeItem(BASE_KEY);
    setStatus({ state: status.state === "sem-banco" ? "sem-banco" : "desligado" });
    throw error;
  }
  return code;
}

export async function joinFamilySync(raw: string) {
  const code = normalizeCode(raw);
  if (code.length !== 20) throw new Error("O código da família tem 20 letras e números.");
  const doc = await request(code, {});
  const base: Record<string, string | null> = {};
  for (const key of SYNCED_KEYS) {
    const server = doc.keys[key] ?? null;
    writeLocal(key, server);
    base[key] = server;
  }
  localStorage.setItem(CODE_KEY, code);
  saveBase(base);
  localStorage.setItem(LAST_KEY, new Date().toISOString());
  setStatus({ devices: devicesOf(doc) });
  window.dispatchEvent(new Event(DATA_EVENT));
}

const FILE_APP = "medplant-familia";

export function exportFamilyFile() {
  const keys: Record<string, string> = {};
  for (const key of SYNCED_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) keys[key] = value;
  }
  const text = JSON.stringify({ app: FILE_APP, version: 1, exportedAt: new Date().toISOString(), keys });
  const day = new Date().toISOString().slice(0, 10);
  return new File([text], `medplant-familia-${day}.json`, { type: "application/json" });
}

const LINK_PARAM = "dados=";

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string) {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function buildFamilyLink(site: string) {
  const keys: Record<string, string> = {};
  for (const key of SYNCED_KEYS) {
    if (key === "medplant-agenda-shifts") continue;
    const value = localStorage.getItem(key);
    if (value !== null) keys[key] = value;
  }
  const json = JSON.stringify({ app: FILE_APP, version: 1, keys });
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return `${site}/sincronizar#${LINK_PARAM}${toBase64Url(bytes)}`;
}

export function linkPayload(hash: string) {
  const value = hash.replace(/^#/, "");
  return value.startsWith(LINK_PARAM) ? value.slice(LINK_PARAM.length) : "";
}

export async function importFamilyLink(payload: string) {
  let text: string;
  try {
    const stream = new Blob([fromBase64Url(payload)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    text = await new Response(stream).text();
  } catch {
    throw new Error("O link está incompleto. Peça para enviarem de novo.");
  }
  importFamilyFile(text);
}

export function importFamilyFile(text: string) {
  let parsed: { app?: string; keys?: Record<string, unknown> };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Esse arquivo não é um arquivo do MedPlant.");
  }
  if (parsed.app !== FILE_APP || !parsed.keys || typeof parsed.keys !== "object") {
    throw new Error("Esse arquivo não é um arquivo do MedPlant.");
  }
  const keys = parsed.keys;
  for (const key of SYNCED_KEYS) {
    const value = keys[key];
    writeLocal(key, typeof value === "string" ? value : null);
  }
  window.dispatchEvent(new Event(DATA_EVENT));
}

export function leaveFamilySync() {
  localStorage.removeItem(CODE_KEY);
  localStorage.removeItem(BASE_KEY);
  localStorage.removeItem(LAST_KEY);
  setStatus({ state: "desligado", message: "", lastSync: "", devices: [] });
}
