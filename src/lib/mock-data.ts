export type ViewScope = "pessoal" | "familia" | "consolidado";

export type ShiftLocation = {
  id: string;
  name: string;
  defaultRate: number;
  color: string;
};

export type Shift = {
  id: string;
  date: string;
  locationId: string;
  start: string;
  end: string;
  paid: boolean;
  title?: string;
};

export type Expense = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  scope: "pessoal" | "familia";
  payment: "debito" | "credito" | "pix" | "dinheiro";
};

export const locations: ShiftLocation[] = [
  { id: "1", name: "Hospital Santa Clara", defaultRate: 1300, color: "#3b9eff" },
  { id: "2", name: "UPA Centro", defaultRate: 1200, color: "#34d399" },
  { id: "3", name: "Clínica Horizonte", defaultRate: 950, color: "#a78bfa" },
];

export const shifts: Shift[] = [
  { id: "s1", date: "2026-10-03", locationId: "1", start: "19:00", end: "07:00", paid: false },
  { id: "s2", date: "2026-10-05", locationId: "2", start: "07:00", end: "19:00", paid: true },
  { id: "s3", date: "2026-10-08", locationId: "1", start: "19:00", end: "07:00", paid: false },
  { id: "s4", date: "2026-10-12", locationId: "3", start: "08:00", end: "14:00", paid: true },
  { id: "s5", date: "2026-10-18", locationId: "2", start: "19:00", end: "07:00", paid: false },
];

export const expenses: Expense[] = [
  {
    id: "e1",
    date: "2026-10-01",
    description: "Supermercado",
    amount: 487.9,
    category: "Casa",
    scope: "familia",
    payment: "credito",
  },
  {
    id: "e2",
    date: "2026-10-02",
    description: "Combustível",
    amount: 220,
    category: "Transporte",
    scope: "pessoal",
    payment: "debito",
  },
  {
    id: "e3",
    date: "2026-10-03",
    description: "Restaurante",
    amount: 89.5,
    category: "Alimentação",
    scope: "pessoal",
    payment: "credito",
  },
  {
    id: "e4",
    date: "2026-10-03",
    description: "Escola filho",
    amount: 1850,
    category: "Educação",
    scope: "familia",
    payment: "pix",
  },
];

export function getLocation(id: string) {
  return locations.find((l) => l.id === id);
}

export function shiftAmount(shift: Shift): number {
  return getLocation(shift.locationId)?.defaultRate ?? 0;
}

export function monthShiftIncome(monthPrefix: string, list: Shift[] = shifts): number {
  return list
    .filter((s) => s.date.startsWith(monthPrefix))
    .reduce((sum, s) => sum + shiftAmount(s), 0);
}

export function monthExpenses(monthPrefix: string, scope: ViewScope): number {
  return expenses
    .filter((e) => e.date.startsWith(monthPrefix))
    .filter((e) => scope === "consolidado" || e.scope === scope || scope === "familia" && e.scope === "familia")
    .filter((e) => {
      if (scope === "pessoal") return e.scope === "pessoal";
      if (scope === "familia") return e.scope === "familia";
      return true;
    })
    .reduce((sum, e) => sum + e.amount, 0);
}
