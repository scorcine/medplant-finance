export const SYNCED_KEYS = [
  "medplant-pessoas",
  "medplant-familia",
  "medplant-locais",
  "medplant-receitas",
  "medplant-gastos",
  "medplant-cartoes",
  "medplant-carteira",
  "medplant-agenda-shifts",
  "medplant-calendar-secret",
  "medplant-agenda-ocultos",
] as const;

type Item = { id: string } & Record<string, unknown>;

export type SyncOp =
  | { type: "set"; value: string | null }
  | { type: "list"; upsert: Item[]; remove: string[] }
  | { type: "object"; set: Record<string, unknown>; remove: string[] };

function parse(raw: string | null | undefined): unknown {
  if (raw === null || raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function isIdList(value: unknown): value is Item[] {
  return Array.isArray(value) && value.every((item) => item && typeof item === "object" && typeof item.id === "string");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function diffValues(base: string | null, local: string | null): SyncOp | null {
  if (base === local) return null;
  if (local === null) return { type: "set", value: null };
  const next = parse(local);
  const previous = parse(base);

  if (isIdList(next) && (previous === undefined || isIdList(previous))) {
    if (previous === undefined) {
      return next.length > 0 ? { type: "list", upsert: next, remove: [] } : { type: "set", value: local };
    }
    const before = new Map(previous.map((item) => [item.id, JSON.stringify(item)]));
    const upsert = next.filter((item) => before.get(item.id) !== JSON.stringify(item));
    const ids = new Set(next.map((item) => item.id));
    const remove = [...before.keys()].filter((id) => !ids.has(id));
    return upsert.length > 0 || remove.length > 0 ? { type: "list", upsert, remove } : null;
  }

  if (isPlainObject(next) && (previous === undefined || isPlainObject(previous))) {
    if (previous === undefined) return { type: "object", set: next, remove: [] };
    const set = Object.fromEntries(
      Object.entries(next).filter(([key, value]) => JSON.stringify(previous[key]) !== JSON.stringify(value)),
    );
    const remove = Object.keys(previous).filter((key) => !(key in next));
    return Object.keys(set).length > 0 || remove.length > 0 ? { type: "object", set, remove } : null;
  }

  return { type: "set", value: local };
}

export function applyOp(current: string | undefined, op: SyncOp): string | undefined {
  if (op.type === "set") return op.value ?? undefined;
  const parsed = parse(current);
  if (op.type === "list") {
    const list = isIdList(parsed) ? parsed.filter((item) => !op.remove.includes(item.id)) : [];
    for (const item of op.upsert ?? []) {
      if (!item || typeof item.id !== "string") continue;
      const index = list.findIndex((existing) => existing.id === item.id);
      if (index >= 0) list[index] = item;
      else list.push(item);
    }
    return JSON.stringify(list);
  }
  const object = isPlainObject(parsed) ? { ...parsed } : {};
  for (const key of op.remove ?? []) delete object[key];
  Object.assign(object, op.set);
  return JSON.stringify(object);
}

export function sameContent(a: string | null | undefined, b: string | null | undefined) {
  if ((a ?? null) === (b ?? null)) return true;
  const left = parse(a);
  const right = parse(b);
  if (isIdList(left) && isIdList(right) && left.length === right.length) {
    const sorted = (list: Item[]) => list.map((item) => JSON.stringify(item)).sort().join("\n");
    return sorted(left) === sorted(right);
  }
  return false;
}
