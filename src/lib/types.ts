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
  calendarId?: string;
  ownerName?: string;
  color?: string;
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

export type CreditCard = {
  id: string;
  name: string;
  last4: string;
  limit: number;
  invoice: number;
  closingDay: number;
  dueDay: number;
};

export type Position = {
  id: string;
  nome: string;
  classe: string;
  aplicado: number;
  atual: number;
};

export function monthExpenses(monthPrefix: string, scope: ViewScope, list: Expense[]): number {
  return list
    .filter((e) => e.date.startsWith(monthPrefix))
    .filter((e) => {
      if (scope === "pessoal") return e.scope === "pessoal";
      if (scope === "familia") return e.scope === "familia";
      return true;
    })
    .reduce((sum, e) => sum + e.amount, 0);
}
