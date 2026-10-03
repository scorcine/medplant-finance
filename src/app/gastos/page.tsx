"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Field, SelectInput, TextInput } from "@/components/form-field";
import { ScopeToggle } from "@/components/scope-toggle";
import type { Expense, ViewScope } from "@/lib/mock-data";
import { loadExpenses, parseMoney, saveExpenses } from "@/lib/records";
import { formatBRL } from "@/lib/utils";

const blank = {
  date: "2026-10-03",
  description: "",
  amount: "",
  category: "Casa",
  scope: "pessoal" as Expense["scope"],
  payment: "debito" as Expense["payment"],
};

export default function GastosPage() {
  const [scope, setScope] = useState<ViewScope>("consolidado");
  const [list, setList] = useState<Expense[]>([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");

  useEffect(() => {
    setList(loadExpenses());
  }, []);

  const filtered = list.filter((expense) => {
    if (scope === "pessoal") return expense.scope === "pessoal";
    if (scope === "familia") return expense.scope === "familia";
    return true;
  });
  const total = filtered.reduce((sum, expense) => sum + expense.amount, 0);

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
        category: form.category,
        scope: form.scope,
        payment: form.payment,
      },
      ...list,
    ];
    setList(next);
    saveExpenses(next);
    setForm({ ...blank, date: form.date, scope: form.scope, payment: form.payment, category: form.category });
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
            O lançamento fica salvo neste navegador e entra no dashboard.
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
            placeholder="Supermercado"
            required
          />
        </Field>
        <Field label="Valor">
          <TextInput
            inputMode="decimal"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            placeholder="89,50"
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

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
        <p className="text-sm text-[var(--color-muted)]">Total na visão atual</p>
        <p className="text-2xl font-semibold">{formatBRL(total)}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Descrição</th>
                <th className="px-5 py-3 font-medium">Categoria</th>
                <th className="px-5 py-3 font-medium">Escopo</th>
                <th className="px-5 py-3 font-medium">Pagamento</th>
                <th className="px-5 py-3 text-right font-medium">Valor</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((expense) => (
                <tr key={expense.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3 text-[var(--color-muted)]">
                    {new Date(expense.date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-5 py-3 font-medium">{expense.description}</td>
                  <td className="px-5 py-3">{expense.category}</td>
                  <td className="px-5 py-3">{expense.scope === "familia" ? "Família" : "Pessoal"}</td>
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
