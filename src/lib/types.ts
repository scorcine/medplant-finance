export type ViewScope = "pessoal" | "familia" | "consolidado";

export type ShiftLocation = {
  id: string;
  name: string;
  defaultRate: number;
  color: string;
  codes?: string[];
};

export type Shift = {
  id: string;
  date: string;
  locationId: string;
  start: string;
  end: string;
  paid: boolean;
  title?: string;
  where?: string;
  manualLocation?: boolean;
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
  paidBy?: string;
  tipo?: ExpenseKind;
  cardId?: string;
  parcelas?: number;
  fimMes?: string;
  importKey?: string;
};

export type ExpenseKind = "fixo" | "cartao" | "variavel";

export const KIND_LABEL: Record<ExpenseKind, string> = {
  fixo: "Fixo",
  cartao: "Cartão de crédito",
  variavel: "Variável",
};

export type ExpenseEntry = {
  expense: Expense;
  kind: ExpenseKind;
  amount: number;
  date: string;
  parcela?: string;
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
  ticker?: string;
  quantidade?: number;
  preco?: number;
  variacaoDia?: number;
  atualizadoEm?: string;
};

export function expenseKind(expense: Expense): ExpenseKind {
  return expense.tipo ?? (expense.payment === "credito" ? "cartao" : "variavel");
}

function monthsBetween(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

function dateInMonth(month: string, day: string) {
  const [year, m] = month.split("-").map(Number);
  const last = new Date(year, m, 0).getDate();
  return `${month}-${String(Math.min(Number(day), last)).padStart(2, "0")}`;
}

export function expensesInMonth(list: Expense[], month: string): ExpenseEntry[] {
  const entries: ExpenseEntry[] = [];
  for (const expense of list) {
    const kind = expenseKind(expense);
    const start = expense.date.slice(0, 7);
    const offset = monthsBetween(start, month);
    if (offset < 0) continue;
    const date = dateInMonth(month, expense.date.slice(8, 10));
    if (kind === "fixo") {
      if (expense.fimMes && month > expense.fimMes) continue;
      entries.push({ expense, kind, amount: expense.amount, date });
    } else if (kind === "cartao" && (expense.parcelas ?? 1) > 1) {
      const total = expense.parcelas ?? 1;
      if (offset >= total) continue;
      entries.push({ expense, kind, amount: expense.amount / total, date, parcela: `${offset + 1}/${total}` });
    } else if (offset === 0) {
      entries.push({ expense, kind, amount: expense.amount, date: expense.date });
    }
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export function inScope(expense: Expense, scope: ViewScope) {
  if (scope === "pessoal") return expense.scope === "pessoal";
  if (scope === "familia") return expense.scope === "familia";
  return true;
}

export function monthExpenses(monthPrefix: string, scope: ViewScope, list: Expense[]): number {
  return expensesInMonth(list, monthPrefix)
    .filter((entry) => inScope(entry.expense, scope))
    .reduce((sum, entry) => sum + entry.amount, 0);
}
