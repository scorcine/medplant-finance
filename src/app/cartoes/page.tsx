"use client";

import { useEffect, useState } from "react";
import { CreditCard as CardIcon, Trash2 } from "lucide-react";
import { Field, TextInput } from "@/components/form-field";
import { currentMonthKey, loadCards, loadExpenses, parseMoney, saveCards } from "@/lib/records";
import { expensesInMonth, type CreditCard, type ExpenseEntry } from "@/lib/types";
import { formatBRL } from "@/lib/utils";

const blank = { name: "", last4: "", limit: "", invoice: "", closingDay: "", dueDay: "" };

export default function CartoesPage() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [monthEntries, setMonthEntries] = useState<ExpenseEntry[]>([]);

  useEffect(() => {
    setCards(loadCards());
    setMonthEntries(expensesInMonth(loadExpenses(), currentMonthKey()));
  }, []);

  function launchedOn(cardId: string) {
    return monthEntries.filter((entry) => entry.expense.cardId === cardId).reduce((sum, entry) => sum + entry.amount, 0);
  }

  function persist(next: CreditCard[]) {
    setCards(next);
    saveCards(next);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const limit = parseMoney(form.limit);
    const invoice = form.invoice.trim() ? parseMoney(form.invoice) : 0;
    const closingDay = Number(form.closingDay);
    const dueDay = Number(form.dueDay);
    const validDay = (day: number) => Number.isInteger(day) && day >= 1 && day <= 31;
    if (!form.name.trim() || !Number.isFinite(limit) || limit <= 0 || !Number.isFinite(invoice) || !validDay(closingDay) || !validDay(dueDay)) {
      setError("Informe o nome, o limite e os dias de fechamento e vencimento (1 a 31).");
      return;
    }
    persist([
      ...cards,
      {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        last4: form.last4.replace(/\D/g, "").slice(-4),
        limit,
        invoice,
        closingDay,
        dueDay,
      },
    ]);
    setForm(blank);
    setError("");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Cartões de crédito</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Cadastre seus cartões para acompanhar fatura, limite e vencimento.</p>
      </header>

      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:grid-cols-3"
      >
        <Field label="Nome do cartão">
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Final do cartão">
          <TextInput inputMode="numeric" maxLength={4} value={form.last4} onChange={(e) => setForm({ ...form, last4: e.target.value })} />
        </Field>
        <Field label="Limite">
          <TextInput inputMode="decimal" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} required />
        </Field>
        <Field label="Fatura atual">
          <TextInput inputMode="decimal" value={form.invoice} onChange={(e) => setForm({ ...form, invoice: e.target.value })} />
        </Field>
        <Field label="Dia do fechamento">
          <TextInput type="number" min={1} max={31} value={form.closingDay} onChange={(e) => setForm({ ...form, closingDay: e.target.value })} required />
        </Field>
        <Field label="Dia do vencimento">
          <TextInput type="number" min={1} max={31} value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} required />
        </Field>
        {error ? <p className="text-sm text-[var(--color-danger)] md:col-span-3">{error}</p> : null}
        <div className="md:col-span-3">
          <button type="submit" className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white">
            Adicionar cartão
          </button>
        </div>
      </form>

      {cards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-sm text-[var(--color-muted)]">
          Nenhum cartão cadastrado ainda.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => {
            const launched = launchedOn(card.id);
            const invoice = launched > 0 ? launched : card.invoice;
            const usage = (invoice / card.limit) * 100;
            return (
              <article
                key={card.id}
                className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface-elevated)] to-[var(--color-surface)] p-6"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-muted)]">{card.name}</p>
                    {card.last4 ? <p className="mt-1 font-mono text-lg tracking-widest">•••• {card.last4}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <CardIcon className="h-6 w-6 text-[var(--color-accent)]" aria-hidden />
                    <button type="button" onClick={() => persist(cards.filter((item) => item.id !== card.id))} aria-label={`Remover ${card.name}`}>
                      <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                    </button>
                  </div>
                </div>
                <div className="mt-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-muted)]">
                      {launched > 0 ? "Lançado em Gastos neste mês" : "Fatura atual"}
                    </span>
                    <span className="font-semibold">{formatBRL(invoice)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-background)]">
                    <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${Math.min(usage, 100)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {usage.toFixed(0)}% do limite de {formatBRL(card.limit)}
                  </p>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[var(--color-muted)]">Fechamento</dt>
                    <dd className="font-medium">Dia {card.closingDay}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-muted)]">Vencimento</dt>
                    <dd className="font-medium">Dia {card.dueDay}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
