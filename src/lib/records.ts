import type { CreditCard, Expense, Income, Position, ShiftLocation } from "@/lib/types";

const LOCATIONS_KEY = "medplant-locais";
const INCOMES_KEY = "medplant-receitas";
const EXPENSES_KEY = "medplant-gastos";
const CARDS_KEY = "medplant-cartoes";
const POSITIONS_KEY = "medplant-carteira";

export const DATA_EVENT = "medplant-dados";

const DEMO_IDS = new Set(["1", "2", "3", "e1", "e2", "e3", "e4", "s1", "s2", "s3", "s4", "s5"]);

export function readList<T extends { id: string }>(key: string): T[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && !DEMO_IDS.has(item.id)) : [];
  } catch {
    return [];
  }
}

export function writeList<T>(key: string, list: T[]) {
  localStorage.setItem(key, JSON.stringify(list));
  window.dispatchEvent(new Event(DATA_EVENT));
}

export const loadLocations = () => readList<ShiftLocation>(LOCATIONS_KEY);
export const saveLocations = (list: ShiftLocation[]) => writeList(LOCATIONS_KEY, list);

export const loadExpenses = () => readList<Expense>(EXPENSES_KEY);
export const saveExpenses = (list: Expense[]) => writeList(EXPENSES_KEY, list);

export const loadCards = () => readList<CreditCard>(CARDS_KEY);
export const saveCards = (list: CreditCard[]) => writeList(CARDS_KEY, list);

export const loadIncomes = () => readList<Income>(INCOMES_KEY);
export const saveIncomes = (list: Income[]) => writeList(INCOMES_KEY, list);

export const loadPositions = () => readList<Position>(POSITIONS_KEY);
export const savePositions = (list: Position[]) => writeList(POSITIONS_KEY, list);

export function parseMoney(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  const numeric = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized;
  const amount = Number(numeric);
  return normalized && Number.isFinite(amount) ? amount : Number.NaN;
}

export function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function currentMonthKey() {
  return todayKey().slice(0, 7);
}
