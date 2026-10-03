"use client";

import { useState } from "react";
import { Filter, Plus } from "lucide-react";
import { ScopeToggle } from "@/components/scope-toggle";
import { expenses, type ViewScope } from "@/lib/mock-data";
import { formatBRL } from "@/lib/utils";

export default function GastosPage() {
  const [scope, setScope] = useState<ViewScope>("consolidado");

  const filtered = expenses.filter((e) => {
    if (scope === "pessoal") return e.scope === "pessoal";
    if (scope === "familia") return e.scope === "familia";
    return true;
  });

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Gastos</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Lançamentos diários e mensais · pessoal e família
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ScopeToggle value={scope} onChange={setScope} />
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Lançar gasto
          </button>
        </div>
      </header>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
        <p className="text-sm text-[var(--color-muted)]">Total em outubro (visão atual)</p>
        <p className="text-2xl font-semibold">{formatBRL(total)}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <span className="text-sm font-medium">Extrato</span>
          <button type="button" className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
            <Filter className="h-3.5 w-3.5" aria-hidden />
            Filtros
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Descrição</th>
                <th className="px-5 py-3 font-medium">Categoria</th>
                <th className="px-5 py-3 font-medium">Escopo</th>
                <th className="px-5 py-3 font-medium">Pagamento</th>
                <th className="px-5 py-3 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3 text-[var(--color-muted)]">
                    {new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-5 py-3 font-medium">{e.description}</td>
                  <td className="px-5 py-3">{e.category}</td>
                  <td className="px-5 py-3 capitalize">{e.scope === "familia" ? "Família" : "Pessoal"}</td>
                  <td className="px-5 py-3 capitalize">{e.payment}</td>
                  <td className="px-5 py-3 text-right font-semibold">{formatBRL(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
