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
  split?: Record<string, number>;
  splitMode?: "valor" | "percentual";
};

export function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}

export function splitExact(total: number, shares: Array<[string, number]>): Array<[string, number]> {
  if (shares.length === 0) return [];
  const result: Array<[string, number]> = [];
  let used = 0;
  shares.forEach(([id, share], index) => {
    const value = index === shares.length - 1 ? roundCents(total - used) : roundCents(total * share);
    used = roundCents(used + value);
    result.push([id, value]);
  });
  return result;
}

export const SPLIT_PAYER = "dividido";

export function payerShares(expense: Expense, memberIds: string[]): Record<string, number> {
  if (expense.paidBy === SPLIT_PAYER) {
    const entries = Object.entries(expense.split ?? {}).filter(([, value]) => value > 0);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    if (total > 0) return Object.fromEntries(entries.map(([id, value]) => [id, value / total]));
    if (memberIds.length === 0) return {};
    return Object.fromEntries(memberIds.map((id) => [id, 1 / memberIds.length]));
  }
  return expense.paidBy ? { [expense.paidBy]: 1 } : {};
}

export function payerAmounts(amount: number, expense: Expense, memberIds: string[]): Array<[string, number]> {
  return splitExact(amount, Object.entries(payerShares(expense, memberIds)));
}

export type Income = {
  id: string;
  date: string;
  description: string;
  amount: number;
  personId?: string;
  fixo?: boolean;
  fimMes?: string;
};

export function incomesInMonth(list: Income[], month: string) {
  return list
    .filter((income) => {
      const start = income.date.slice(0, 7);
      if (income.fixo) return start <= month && (!income.fimMes || month <= income.fimMes);
      return start === month;
    })
    .sort((a, b) => a.description.localeCompare(b.description));
}

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
