"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, Square, Trash2 } from "lucide-react";
import { Field, SelectInput, TextInput } from "@/components/form-field";
import { ScopeToggle } from "@/components/scope-toggle";
import {
  KIND_LABEL,
  expensesInMonth,
  inScope,
  type CreditCard,
  type Expense,
  type ExpenseEntry,
  type ExpenseKind,
  type ViewScope,
} from "@/lib/types";
import {
  currentMonthKey,
  DATA_EVENT,
  loadCards,
  loadExpenses,
  parseMoney,
  saveExpenses,
  todayKey,
} from "@/lib/records";
import { loadFamily, loadOwner, loadPeople, type FamilyGroup, type Person } from "@/lib/people";
import { cn, formatBRL } from "@/lib/utils";

const KINDS: ExpenseKind[] = ["fixo", "cartao", "variavel"];

const KIND_HINT: Record<ExpenseKind, string> = {
  fixo: "Entra todo mês sozinho, a partir da data de início, até você encerrar.",
  cartao: "Compra no cartão. Parcelado entra uma parcela em cada mês.",
  variavel: "Gasto do dia a dia, só no mês da data.",
};

const blank = {
  tipo: "variavel" as ExpenseKind,
  date: "",
  description: "",
  amount: "",
  category: "",
  scope: "pessoal" as Expense["scope"],
  payment: "debito" as Expense["payment"],
  paidBy: "",
  cardId: "",
  parcelas: "1",
};

const DIVISAO_LABEL: Record<FamilyGroup["divisao"], string> = {
  igual: "Igual entre os adultos",
  proporcional: "Proporcional à renda",
  titular: "Titular paga as despesas da casa",
  personalizado: "Personalizado: cada um informa o que paga",
};

function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number);
  const label = new Date(year, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function firstName(name: string) {
  return name.split(" ")[0];
}

export default function GastosPage() {
  const [scope, setScope] = useState<ViewScope>("consolidado");
  const [list, setList] = useState<Expense[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [family, setFamily] = useState<FamilyGroup>({ nomeFamilia: "", divisao: "igual", membros: [] });
  const [month, setMonth] = useState("");
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");

  useEffect(() => {
    function refresh() {
      setPeople(loadPeople());
      setFamily(loadFamily());
      setCards(loadCards());
    }
    refresh();
    setList(loadExpenses());
    setMonth(currentMonthKey());
    setForm((current) => ({ ...current, date: todayKey(), paidBy: loadOwner()?.id ?? "" }));
    window.addEventListener(DATA_EVENT, refresh);
    return () => window.removeEventListener(DATA_EVENT, refresh);
  }, []);

  const payers = useMemo(() => {
    const familyIds = family.membros.map((member) => member.personId);
    const inFamily = people.filter((person) => familyIds.includes(person.id));
    return inFamily.length > 0 ? inFamily : people;
  }, [people, family]);

  useEffect(() => {
    if (payers.length > 0 && !payers.some((person) => person.id === form.paidBy)) {
      setForm((current) => ({ ...current, paidBy: payers[0].id }));
    }
  }, [payers, form.paidBy]);

  useEffect(() => {
    if (form.tipo === "cartao" && cards.length > 0 && !cards.some((card) => card.id === form.cardId)) {
      setForm((current) => ({ ...current, cardId: cards[0].id }));
    }
  }, [cards, form.tipo, form.cardId]);

  function personName(id?: string) {
    if (!id) return "Não informado";
    return people.find((person) => person.id === id)?.nome ?? "Não informado";
  }

  function cardName(id?: string) {
    return cards.find((card) => card.id === id)?.name ?? "";
  }

  const entries = month ? expensesInMonth(list, month) : [];
  const visible = entries.filter((entry) => inScope(entry.expense, scope));
  const totalOf = (kind: ExpenseKind) =>
    visible.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + entry.amount, 0);
  const total = visible.reduce((sum, entry) => sum + entry.amount, 0);

  const familyEntries = entries.filter((entry) => entry.expense.scope === "familia");
  const familyTotal = familyEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const familyMembers = people.filter((person) => family.membros.some((member) => member.personId === person.id));
  const equalShare = familyMembers.length > 0 ? familyTotal / familyMembers.length : 0;
  const unassigned = familyEntries
    .filter((entry) => !familyMembers.some((person) => person.id === entry.expense.paidBy))
    .reduce((sum, entry) => sum + entry.amount, 0);

  function persist(next: Expense[]) {
    setList(next);
    saveExpenses(next);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const amount = parseMoney(form.amount);
    if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Informe a descrição e um valor maior que zero.");
      return;
    }
    const parcelas = form.tipo === "cartao" ? Math.max(1, Math.min(48, Math.round(Number(form.parcelas) || 1))) : undefined;
    const expense: Expense = {
      id: crypto.randomUUID(),
      date: form.date,
      description: form.description.trim(),
      amount,
      category: form.category.trim() || "Sem categoria",
      scope: form.scope,
      payment: form.tipo === "cartao" ? "credito" : form.payment,
      paidBy: form.paidBy || undefined,
      tipo: form.tipo,
      cardId: form.tipo === "cartao" ? form.cardId || undefined : undefined,
      parcelas,
    };
    persist([expense, ...list]);
    if (form.date.slice(0, 7) !== month) setMonth(form.date.slice(0, 7));
    setForm({ ...form, description: "", amount: "", parcelas: "1" });
    setError("");
  }

  function remove(id: string) {
    persist(list.filter((expense) => expense.id !== id));
  }

  function endFixed(entry: ExpenseEntry) {
    const start = entry.expense.date.slice(0, 7);
    if (month <= start) {
      remove(entry.expense.id);
      return;
    }
    persist(list.map((expense) => (expense.id === entry.expense.id ? { ...expense, fimMes: shiftMonth(month, -1) } : expense)));
  }

  function changeFixedValue(entry: ExpenseEntry) {
    const typed = window.prompt(
      `Novo valor mensal de "${entry.expense.description}" a partir de ${monthLabel(month)}:`,
      entry.amount.toFixed(2).replace(".", ","),
    );
    if (typed === null) return;
    const amount = parseMoney(typed);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const start = entry.expense.date.slice(0, 7);
    if (month === start) {
      persist(list.map((expense) => (expense.id === entry.expense.id ? { ...expense, amount } : expense)));
      return;
    }
    const continuation: Expense = {
      ...entry.expense,
      id: crypto.randomUUID(),
      amount,
      date: `${month}-${entry.expense.date.slice(8, 10)}`,
    };
    persist([
      continuation,
      ...list.map((expense) => (expense.id === entry.expense.id ? { ...expense, fimMes: shiftMonth(month, -1) } : expense)),
    ]);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Gastos</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Fixos, cartão de crédito e variáveis, mês a mês, com quem pagou cada um.
          </p>
        </div>
        <ScopeToggle value={scope} onChange={setScope} />
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      >
        <div>
          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-1">
            {KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setForm({ ...form, tipo: kind })}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium",
                  form.tipo === kind ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)]",
                )}
              >
                {KIND_LABEL[kind]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">{KIND_HINT[form.tipo]}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label={form.tipo === "fixo" ? "Início (dia do vencimento)" : form.tipo === "cartao" ? "Data da compra" : "Data"}>
            <TextInput type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
          </Field>
          <Field label="Descrição" className="md:col-span-2">
            <TextInput
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              required
            />
          </Field>
          <Field label={form.tipo === "fixo" ? "Valor mensal" : form.tipo === "cartao" ? "Valor total da compra" : "Valor"}>
            <TextInput
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              required
            />
          </Field>
          {form.tipo === "cartao" ? (
            <>
              <Field label="Cartão">
                {cards.length === 0 ? (
                  <p className="py-2.5 text-sm text-[var(--color-muted)]">
                    <Link href="/cartoes" className="text-[var(--color-accent)] hover:underline">
                      Cadastrar cartão
                    </Link>
                  </p>
                ) : (
                  <SelectInput value={form.cardId} onChange={(event) => setForm({ ...form, cardId: event.target.value })}>
                    {cards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                        {card.last4 ? ` •••• ${card.last4}` : ""}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>
              <Field label="Parcelas">
                <SelectInput value={form.parcelas} onChange={(event) => setForm({ ...form, parcelas: event.target.value })}>
                  {Array.from({ length: 24 }, (_, index) => index + 1).map((count) => (
                    <option key={count} value={count}>
                      {count === 1 ? "À vista" : `${count}x`}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </>
          ) : (
            <Field label="Pagamento">
              <SelectInput
                value={form.payment}
                onChange={(event) => setForm({ ...form, payment: event.target.value as Expense["payment"] })}
              >
                <option value="debito">Débito</option>
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="credito">Crédito</option>
              </SelectInput>
            </Field>
          )}
          <Field label="Categoria">
            <TextInput value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
          </Field>
          <Field label="Escopo">
            <SelectInput
              value={form.scope}
              onChange={(event) => setForm({ ...form, scope: event.target.value as Expense["scope"] })}
            >
              <option value="pessoal">Pessoal</option>
              <option value="familia">Família</option>
            </SelectInput>
          </Field>
          <Field label="Quem pagou">
            <SelectInput value={form.paidBy} onChange={(event) => setForm({ ...form, paidBy: event.target.value })}>
              {payers.length === 0 ? <option value="">Não informado</option> : null}
              {payers.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.nome}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        {form.tipo === "cartao" && Number(form.parcelas) > 1 && parseMoney(form.amount) > 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            {form.parcelas}x de {formatBRL(parseMoney(form.amount) / Number(form.parcelas))}
          </p>
        ) : null}
        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        <button type="submit" className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white">
          {form.tipo === "fixo" ? "Lançar gasto fixo" : form.tipo === "cartao" ? "Lançar compra no cartão" : "Lançar gasto"}
        </button>
      </form>

      <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
        <button
          type="button"
          onClick={() => setMonth((current) => shiftMonth(current, -1))}
          aria-label="Mês anterior"
          className="rounded-lg p-2 hover:bg-[var(--color-background)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-semibold">{month ? monthLabel(month) : ""}</p>
        <button
          type="button"
          onClick={() => setMonth((current) => shiftMonth(current, 1))}
          aria-label="Próximo mês"
          className="rounded-lg p-2 hover:bg-[var(--color-background)]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KINDS.map((kind) => (
          <div key={kind} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
            <p className="text-sm text-[var(--color-muted)]">{kind === "fixo" ? "Fixos" : kind === "cartao" ? "Cartão de crédito" : "Variáveis"}</p>
            <p className="text-xl font-semibold">{formatBRL(totalOf(kind))}</p>
          </div>
        ))}
        <div className="rounded-2xl border border-[var(--color-accent)]/40 bg-[var(--color-surface)] px-5 py-4">
          <p className="text-sm text-[var(--color-muted)]">Total do mês</p>
          <p className="text-xl font-semibold">{formatBRL(total)}</p>
        </div>
      </section>

      {KINDS.map((kind) => {
        const items = visible.filter((entry) => entry.kind === kind);
        return (
          <section key={kind} className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="flex items-baseline justify-between px-5 pt-5">
              <h2 className="text-lg font-semibold">
                {kind === "fixo" ? "Gastos fixos" : kind === "cartao" ? "Cartão de crédito" : "Gastos variáveis"}
              </h2>
              <p className="text-sm font-semibold">{formatBRL(totalOf(kind))}</p>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                    <th className="px-5 py-3 font-medium">{kind === "fixo" ? "Vence" : "Data"}</th>
                    <th className="px-5 py-3 font-medium">Descrição</th>
                    <th className="px-5 py-3 font-medium">Categoria</th>
                    <th className="px-5 py-3 font-medium">Escopo</th>
                    <th className="px-5 py-3 font-medium">Quem pagou</th>
                    <th className="px-5 py-3 text-right font-medium">Valor</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-5 text-[var(--color-muted)]">
                        Nada neste mês.
                      </td>
                    </tr>
                  ) : null}
                  {items.map((entry) => (
                    <tr key={entry.expense.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-5 py-3 text-[var(--color-muted)]">
                        {new Date(entry.date + "T12:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-medium">{entry.expense.description}</span>
                        {entry.parcela ? (
                          <span className="ml-2 text-xs text-[var(--color-muted)]">parcela {entry.parcela}</span>
                        ) : null}
                        {kind === "cartao" && cardName(entry.expense.cardId) ? (
                          <span className="block text-xs text-[var(--color-muted)]">{cardName(entry.expense.cardId)}</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">{entry.expense.category}</td>
                      <td className="px-5 py-3">{entry.expense.scope === "familia" ? "Família" : "Pessoal"}</td>
                      <td className="px-5 py-3">{personName(entry.expense.paidBy)}</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatBRL(entry.amount)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-3">
                          {kind === "fixo" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => changeFixedValue(entry)}
                                aria-label={`Alterar valor de ${entry.expense.description}`}
                                title="Alterar o valor a partir deste mês"
                              >
                                <Pencil className="h-4 w-4 text-[var(--color-muted)]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => endFixed(entry)}
                                aria-label={`Encerrar ${entry.expense.description}`}
                                title="Encerrar a partir deste mês"
                              >
                                <Square className="h-4 w-4 text-[var(--color-warning)]" />
                              </button>
                            </>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => remove(entry.expense.id)}
                            aria-label={`Excluir ${entry.expense.description}`}
                            title={kind === "fixo" || entry.parcela ? "Excluir de todos os meses" : "Excluir"}
                          >
                            <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold">Custos da família no mês</p>
          {familyMembers.length > 0 ? (
            <p className="text-xs text-[var(--color-muted)]">{DIVISAO_LABEL[family.divisao]}</p>
          ) : null}
        </div>
        {familyMembers.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Monte a família em{" "}
            <Link href="/cadastro/familia" className="text-[var(--color-accent)] hover:underline">
              Inclusão da família
            </Link>{" "}
            para ver quanto cada um pagou.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {familyMembers.map((person) => {
              const paid = familyEntries
                .filter((entry) => entry.expense.paidBy === person.id)
                .reduce((sum, entry) => sum + entry.amount, 0);
              const share = familyTotal > 0 ? Math.round((paid / familyTotal) * 100) : 0;
              const balance = paid - equalShare;
              return (
                <li key={person.id} className="flex flex-wrap justify-between gap-2">
                  <span>{person.nome}</span>
                  <span className="text-right">
                    {formatBRL(paid)} <span className="text-[var(--color-muted)]">({share}%)</span>
                    {family.divisao === "igual" && familyTotal > 0 && Math.abs(balance) >= 0.01 ? (
                      <span
                        className={
                          balance > 0
                            ? "ml-2 text-xs text-[var(--color-success)]"
                            : "ml-2 text-xs text-[var(--color-danger)]"
                        }
                      >
                        {balance > 0
                          ? `${firstName(person.nome)} recebe ${formatBRL(balance)}`
                          : `${firstName(person.nome)} deve ${formatBRL(-balance)}`}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
            {unassigned > 0 ? (
              <li className="flex justify-between gap-2 text-[var(--color-muted)]">
                <span>Sem pagador informado</span>
                <span>{formatBRL(unassigned)}</span>
              </li>
            ) : null}
            <li className="flex justify-between gap-2 border-t border-[var(--color-border)] pt-2 font-semibold">
              <span>Total da casa</span>
              <span>{formatBRL(familyTotal)}</span>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
