"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Scale, Square, Trash2 } from "lucide-react";
import { Field, SelectInput, TextInput } from "@/components/form-field";
import { loadFamily, loadOwner, loadPeople, type Person } from "@/lib/people";
import {
  currentMonthKey,
  DATA_EVENT,
  loadExpenses,
  loadIncomes,
  loadLocations,
  parseMoney,
  saveIncomes,
} from "@/lib/records";
import { loadImportedShifts } from "@/lib/shifts-store";
import {
  KIND_LABEL,
  expensesInMonth,
  incomesInMonth,
  payerAmounts,
  roundCents,
  type Expense,
  type ExpenseKind,
  type Income,
  type Shift,
  type ShiftLocation,
} from "@/lib/types";
import { cn, formatBRL } from "@/lib/utils";

const KINDS: ExpenseKind[] = ["fixo", "cartao", "variavel"];

function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string, short = false) {
  const [year, m] = month.split("-").map(Number);
  const label = new Date(year, m - 1, 1).toLocaleDateString("pt-BR", short ? { month: "short", year: "2-digit" } : { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function firstName(name: string) {
  return name.split(" ")[0];
}

const blankIncome = { description: "", amount: "", month: "", personId: "", fixo: false };

export default function BalancoPage() {
  const [month, setMonth] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [places, setPlaces] = useState<ShiftLocation[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [form, setForm] = useState(blankIncome);
  const [error, setError] = useState("");

  useEffect(() => {
    function refresh() {
      const loadedPeople = loadPeople();
      const familyIds = loadFamily().membros.map((member) => member.personId);
      const members = loadedPeople.filter((person) => familyIds.includes(person.id));
      setPeople(loadedPeople);
      setMemberIds((members.length > 0 ? members : loadedPeople).map((person) => person.id));
      setOwnerId(loadOwner()?.id ?? "");
      setPlaces(loadLocations());
      setShifts(loadImportedShifts());
      setExpenses(loadExpenses());
      setIncomes(loadIncomes());
    }
    refresh();
    const current = currentMonthKey();
    setMonth(current);
    setForm((value) => ({ ...value, month: shiftMonth(current, -1), personId: loadOwner()?.id ?? "" }));
    window.addEventListener(DATA_EVENT, refresh);
    return () => window.removeEventListener(DATA_EVENT, refresh);
  }, []);

  const members = useMemo(
    () => memberIds.map((id) => people.find((person) => person.id === id)).filter((person): person is Person => Boolean(person)),
    [memberIds, people],
  );

  function personName(id: string) {
    return people.find((person) => person.id === id)?.nome ?? "Não informado";
  }

  function earningsOf(earnMonth: string) {
    const byPerson = new Map<string, number>();
    const add = (id: string, value: number) => byPerson.set(id, roundCents((byPerson.get(id) ?? 0) + value));
    let shiftTotal = 0;
    let shiftCount = 0;
    for (const shift of shifts) {
      if (!shift.date.startsWith(earnMonth)) continue;
      const rate = places.find((place) => place.id === shift.locationId)?.defaultRate;
      if (!rate) continue;
      shiftTotal = roundCents(shiftTotal + rate);
      shiftCount += 1;
      add(shift.calendarId ?? ownerId ?? "nenhum", rate);
    }
    const others = incomesInMonth(incomes, earnMonth);
    for (const income of others) add(income.personId ?? "nenhum", income.amount);
    const otherTotal = roundCents(others.reduce((sum, income) => sum + income.amount, 0));
    return { byPerson, shiftTotal, shiftCount, others, otherTotal, total: roundCents(shiftTotal + otherTotal) };
  }

  function spendingOf(spendMonth: string) {
    const entries = expensesInMonth(expenses, spendMonth);
    const byPerson = new Map<string, number>();
    for (const entry of entries) {
      const parts = payerAmounts(entry.amount, entry.expense, memberIds);
      const assigned = parts.length > 0 ? parts : [["nenhum", entry.amount] as [string, number]];
      for (const [id, value] of assigned) byPerson.set(id, roundCents((byPerson.get(id) ?? 0) + value));
    }
    const byKind = Object.fromEntries(
      KINDS.map((kind) => [
        kind,
        roundCents(entries.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + entry.amount, 0)),
      ]),
    ) as Record<ExpenseKind, number>;
    const total = roundCents(entries.reduce((sum, entry) => sum + entry.amount, 0));
    return { entries, byPerson, byKind, total };
  }

  if (!month) return null;

  const previous = shiftMonth(month, -1);
  const earnings = earningsOf(previous);
  const spending = spendingOf(month);
  const balance = roundCents(earnings.total - spending.total);
  const coverage = spending.total > 0 ? Math.min(100, (earnings.total / spending.total) * 100) : 100;

  const personIds = Array.from(
    new Set([...memberIds, ...earnings.byPerson.keys(), ...spending.byPerson.keys()].filter((id) => id !== "nenhum")),
  );
  const unassignedEarn = earnings.byPerson.get("nenhum") ?? 0;
  const unassignedSpend = spending.byPerson.get("nenhum") ?? 0;

  const history = Array.from({ length: 6 }, (_, index) => {
    const m = shiftMonth(month, index - 5);
    const earn = earningsOf(shiftMonth(m, -1)).total;
    const spend = spendingOf(m).total;
    return { month: m, earn, spend, balance: roundCents(earn - spend) };
  });
  const maxBar = Math.max(1, ...history.flatMap((item) => [item.earn, item.spend]));

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const amount = parseMoney(form.amount);
    if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0 || !form.month) {
      setError("Informe a descrição, o valor e o mês em que recebeu.");
      return;
    }
    const next: Income[] = [
      ...incomes,
      {
        id: crypto.randomUUID(),
        date: `${form.month}-01`,
        description: form.description.trim(),
        amount: roundCents(amount),
        personId: form.personId || undefined,
        fixo: form.fixo,
      },
    ];
    setIncomes(next);
    saveIncomes(next);
    setForm({ ...blankIncome, month: form.month, personId: form.personId });
    setError("");
  }

  function removeIncome(id: string) {
    const next = incomes.filter((income) => income.id !== id);
    setIncomes(next);
    saveIncomes(next);
  }

  function endIncome(income: Income) {
    if (previous <= income.date.slice(0, 7)) {
      removeIncome(income.id);
      return;
    }
    const next = incomes.map((item) => (item.id === income.id ? { ...item, fimMes: shiftMonth(previous, -1) } : item));
    setIncomes(next);
    saveIncomes(next);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <Scale className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Balanço</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Os ganhos de um mês pagam os gastos do mês seguinte.
          </p>
        </div>
      </header>

      <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
        <button
          type="button"
          onClick={() => setMonth((current) => shiftMonth(current, -1))}
          aria-label="Mês anterior"
          className="rounded-lg p-2 hover:bg-[var(--color-background)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="font-semibold">Gastos de {monthLabel(month)}</p>
          <p className="text-xs text-[var(--color-muted)]">pagos com os ganhos de {monthLabel(previous)}</p>
        </div>
        <button
          type="button"
          onClick={() => setMonth((current) => shiftMonth(current, 1))}
          aria-label="Próximo mês"
          className="rounded-lg p-2 hover:bg-[var(--color-background)]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-sm text-[var(--color-muted)]">Ganhos de {monthLabel(previous)}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-success)]">{formatBRL(earnings.total)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-sm text-[var(--color-muted)]">Gastos de {monthLabel(month)}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-danger)]">{formatBRL(spending.total)}</p>
        </div>
        <div
          className={cn(
            "rounded-2xl border bg-[var(--color-surface)] p-5",
            balance >= 0 ? "border-[var(--color-success)]/40" : "border-[var(--color-danger)]/40",
          )}
        >
          <p className="text-sm text-[var(--color-muted)]">{balance >= 0 ? "Sobra" : "Falta"}</p>
          <p className={cn("mt-1 text-2xl font-semibold", balance >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
            {formatBRL(Math.abs(balance))}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-background)]">
            <div
              className={cn("h-full rounded-full", balance >= 0 ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]")}
              style={{ width: `${coverage}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Os ganhos cobrem {spending.total > 0 ? `${Math.round((earnings.total / spending.total) * 100)}%` : "100%"} dos gastos
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Ganhos de {monthLabel(previous)}</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex justify-between gap-3">
              <span>
                Plantões{" "}
                <span className="text-[var(--color-muted)]">
                  ({earnings.shiftCount} na{" "}
                  <Link href="/agenda" className="text-[var(--color-accent)] hover:underline">
                    agenda
                  </Link>
                  )
                </span>
              </span>
              <span className="font-medium">{formatBRL(earnings.shiftTotal)}</span>
            </li>
            {earnings.others.map((income) => (
              <li key={income.id} className="flex items-center justify-between gap-3">
                <span>
                  {income.description}
                  <span className="text-[var(--color-muted)]">
                    {" "}
                    · {income.personId ? firstName(personName(income.personId)) : "Não informado"}
                    {income.fixo ? " · todo mês" : ""}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-medium">{formatBRL(income.amount)}</span>
                  {income.fixo ? (
                    <button type="button" onClick={() => endIncome(income)} title="Encerrar a partir deste mês" aria-label={`Encerrar ${income.description}`}>
                      <Square className="h-4 w-4 text-[var(--color-warning)]" />
                    </button>
                  ) : null}
                  <button type="button" onClick={() => removeIncome(income.id)} title="Excluir" aria-label={`Excluir ${income.description}`}>
                    <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                  </button>
                </span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t border-[var(--color-border)] pt-2 font-semibold">
              <span>Total</span>
              <span>{formatBRL(earnings.total)}</span>
            </li>
          </ul>

          <form onSubmit={onSubmit} className="mt-5 grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 sm:grid-cols-2">
            <p className="text-sm font-semibold sm:col-span-2">Adicionar outro ganho (salário, aluguel, pró-labore)</p>
            <Field label="Descrição">
              <TextInput value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
            </Field>
            <Field label="Valor">
              <TextInput inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required />
            </Field>
            <Field label="Mês em que recebeu">
              <TextInput type="month" value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })} required />
            </Field>
            <Field label="De quem">
              <SelectInput value={form.personId} onChange={(event) => setForm({ ...form, personId: event.target.value })}>
                <option value="">Não informado</option>
                {members.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.nome}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.fixo}
                onChange={(event) => setForm({ ...form, fixo: event.target.checked })}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              Recebe todo mês (entra sozinho nos próximos meses)
            </label>
            {error ? <p className="text-sm text-[var(--color-danger)] sm:col-span-2">{error}</p> : null}
            <div className="sm:col-span-2">
              <button type="submit" className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white">
                Adicionar ganho
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Gastos de {monthLabel(month)}</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {KINDS.map((kind) => (
              <li key={kind} className="flex justify-between gap-3">
                <span>{KIND_LABEL[kind]}</span>
                <span className="font-medium">{formatBRL(spending.byKind[kind])}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t border-[var(--color-border)] pt-2 font-semibold">
              <span>Total</span>
              <span>{formatBRL(spending.total)}</span>
            </li>
          </ul>
          <Link href="/gastos" className="mt-3 inline-block text-sm text-[var(--color-accent)] hover:underline">
            Ver os gastos do mês
          </Link>

          <h3 className="mt-6 font-semibold">Por pessoa</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th className="py-2 font-medium">Pessoa</th>
                  <th className="py-2 text-right font-medium">Ganhou</th>
                  <th className="py-2 text-right font-medium">Pagou</th>
                  <th className="py-2 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {personIds.map((id) => {
                  const earned = earnings.byPerson.get(id) ?? 0;
                  const paid = spending.byPerson.get(id) ?? 0;
                  const net = roundCents(earned - paid);
                  return (
                    <tr key={id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-2">{personName(id)}</td>
                      <td className="py-2 text-right">{formatBRL(earned)}</td>
                      <td className="py-2 text-right">{formatBRL(paid)}</td>
                      <td className={cn("py-2 text-right font-semibold", net >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
                        {formatBRL(net)}
                      </td>
                    </tr>
                  );
                })}
                {unassignedEarn > 0 || unassignedSpend > 0 ? (
                  <tr className="text-[var(--color-muted)]">
                    <td className="py-2">Não informado</td>
                    <td className="py-2 text-right">{formatBRL(unassignedEarn)}</td>
                    <td className="py-2 text-right">{formatBRL(unassignedSpend)}</td>
                    <td className="py-2 text-right">{formatBRL(roundCents(unassignedEarn - unassignedSpend))}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-lg font-semibold">Últimos 6 meses</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">Em cada mês: ganhos do mês anterior contra os gastos do mês.</p>
        <div className="mt-5 grid grid-cols-6 items-end gap-3" style={{ height: 160 }}>
          {history.map((item) => (
            <button
              key={item.month}
              type="button"
              onClick={() => setMonth(item.month)}
              className="flex h-full flex-col justify-end gap-1"
              title={`${monthLabel(item.month)}: ganhos ${formatBRL(item.earn)}, gastos ${formatBRL(item.spend)}`}
            >
              <div className="flex h-full items-end justify-center gap-1">
                <span className="w-3 rounded-t bg-[var(--color-success)]" style={{ height: `${(item.earn / maxBar) * 100}%` }} />
                <span className="w-3 rounded-t bg-[var(--color-danger)]" style={{ height: `${(item.spend / maxBar) * 100}%` }} />
              </div>
            </button>
          ))}
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <th className="py-2 font-medium">Mês dos gastos</th>
                <th className="py-2 text-right font-medium">Ganhos do mês anterior</th>
                <th className="py-2 text-right font-medium">Gastos</th>
                <th className="py-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr
                  key={item.month}
                  className={cn("border-b border-[var(--color-border)] last:border-0", item.month === month && "bg-[var(--color-accent-soft)]")}
                >
                  <td className="py-2">{monthLabel(item.month, true)}</td>
                  <td className="py-2 text-right text-[var(--color-success)]">{formatBRL(item.earn)}</td>
                  <td className="py-2 text-right text-[var(--color-danger)]">{formatBRL(item.spend)}</td>
                  <td className={cn("py-2 text-right font-semibold", item.balance >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
                    {formatBRL(item.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
