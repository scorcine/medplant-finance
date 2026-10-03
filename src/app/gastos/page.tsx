"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Field, SelectInput, TextInput } from "@/components/form-field";
import { ScopeToggle } from "@/components/scope-toggle";
import type { Expense, ViewScope } from "@/lib/types";
import { currentMonthKey, DATA_EVENT, loadExpenses, parseMoney, saveExpenses, todayKey } from "@/lib/records";
import { loadFamily, loadOwner, loadPeople, type FamilyGroup, type Person } from "@/lib/people";
import { formatBRL } from "@/lib/utils";

const blank = {
  date: "",
  description: "",
  amount: "",
  category: "",
  scope: "pessoal" as Expense["scope"],
  payment: "debito" as Expense["payment"],
  paidBy: "",
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
  const [family, setFamily] = useState<FamilyGroup>({ nomeFamilia: "", divisao: "igual", membros: [] });
  const [month, setMonth] = useState("");
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");

  useEffect(() => {
    function refresh() {
      setPeople(loadPeople());
      setFamily(loadFamily());
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

  function personName(id?: string) {
    if (!id) return "Não informado";
    return people.find((person) => person.id === id)?.nome ?? "Não informado";
  }

  const inMonth = list.filter((expense) => expense.date.startsWith(month));
  const filtered = inMonth.filter((expense) => {
    if (scope === "pessoal") return expense.scope === "pessoal";
    if (scope === "familia") return expense.scope === "familia";
    return true;
  });
  const total = filtered.reduce((sum, expense) => sum + expense.amount, 0);

  const familyExpenses = inMonth.filter((expense) => expense.scope === "familia");
  const familyTotal = familyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const familyMembers = people.filter((person) => family.membros.some((member) => member.personId === person.id));
  const equalShare = familyMembers.length > 0 ? familyTotal / familyMembers.length : 0;
  const unassigned = familyExpenses
    .filter((expense) => !familyMembers.some((person) => person.id === expense.paidBy))
    .reduce((sum, expense) => sum + expense.amount, 0);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const amount = parseMoney(form.amount);
    if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Informe a descrição e um valor maior que zero.");
      return;
    }
    const next = [
      {
        id: crypto.randomUUID(),
        date: form.date,
        description: form.description.trim(),
        amount,
        category: form.category.trim() || "Sem categoria",
        scope: form.scope,
        payment: form.payment,
        paidBy: form.paidBy || undefined,
      },
      ...list,
    ];
    setList(next);
    saveExpenses(next);
    if (form.date.slice(0, 7) !== month) setMonth(form.date.slice(0, 7));
    setForm({ ...blank, date: form.date, scope: form.scope, payment: form.payment, category: form.category, paidBy: form.paidBy });
    setError("");
  }

  function remove(id: string) {
    const next = list.filter((expense) => expense.id !== id);
    setList(next);
    saveExpenses(next);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Gastos</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Gastos pessoais e custos da família, mês a mês, com quem pagou cada um.
          </p>
        </div>
        <ScopeToggle value={scope} onChange={setScope} />
      </header>

      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:grid-cols-3"
      >
        <Field label="Data">
          <TextInput type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
        </Field>
        <Field label="Descrição" className="md:col-span-2">
          <TextInput
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            required
          />
        </Field>
        <Field label="Valor">
          <TextInput
            inputMode="decimal"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            required
          />
        </Field>
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
        <Field label="Pagamento">
          <SelectInput
            value={form.payment}
            onChange={(event) => setForm({ ...form, payment: event.target.value as Expense["payment"] })}
          >
            <option value="debito">Débito</option>
            <option value="credito">Crédito</option>
            <option value="pix">Pix</option>
            <option value="dinheiro">Dinheiro</option>
          </SelectInput>
        </Field>
        {error ? <p className="text-sm text-[var(--color-danger)] md:col-span-3">{error}</p> : null}
        <div className="md:col-span-3">
          <button type="submit" className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white">
            Lançar gasto
          </button>
        </div>
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

      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <p className="text-sm text-[var(--color-muted)]">Total do mês na visão atual</p>
          <p className="text-2xl font-semibold">{formatBRL(total)}</p>
        </div>

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
                const paid = familyExpenses
                  .filter((expense) => expense.paidBy === person.id)
                  .reduce((sum, expense) => sum + expense.amount, 0);
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

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Descrição</th>
                <th className="px-5 py-3 font-medium">Categoria</th>
                <th className="px-5 py-3 font-medium">Escopo</th>
                <th className="px-5 py-3 font-medium">Quem pagou</th>
                <th className="px-5 py-3 font-medium">Pagamento</th>
                <th className="px-5 py-3 text-right font-medium">Valor</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-6 text-[var(--color-muted)]">
                    Nenhum gasto lançado neste mês.
                  </td>
                </tr>
              ) : null}
              {filtered.map((expense) => (
                <tr key={expense.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3 text-[var(--color-muted)]">
                    {new Date(expense.date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-5 py-3 font-medium">{expense.description}</td>
                  <td className="px-5 py-3">{expense.category}</td>
                  <td className="px-5 py-3">{expense.scope === "familia" ? "Família" : "Pessoal"}</td>
                  <td className="px-5 py-3">{personName(expense.paidBy)}</td>
                  <td className="px-5 py-3 capitalize">{expense.payment}</td>
                  <td className="px-5 py-3 text-right font-semibold">{formatBRL(expense.amount)}</td>
                  <td className="px-5 py-3 text-right">
                    <button type="button" onClick={() => remove(expense.id)} aria-label={`Remover ${expense.description}`}>
                      <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
