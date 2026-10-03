import { expenses as sampleExpenses, locations as sampleLocations, type Expense, type ShiftLocation } from "@/lib/mock-data";

const LOCATIONS_KEY = "medplant-locais";
const EXPENSES_KEY = "medplant-gastos";

function read<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function loadLocations() {
  return read<ShiftLocation>(LOCATIONS_KEY, sampleLocations);
}

export function saveLocations(list: ShiftLocation[]) {
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(list));
}

export function loadExpenses() {
  return read<Expense>(EXPENSES_KEY, sampleExpenses);
}

export function saveExpenses(list: Expense[]) {
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(list));
}

export function parseMoney(value: string) {
  const normalized = value.trim().replace(/\s/g, "");
  const numeric = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized;
  const amount = Number(numeric);
  return Number.isFinite(amount) ? amount : Number.NaN;
}
