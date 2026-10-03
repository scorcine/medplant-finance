"use client";

import { MapPin, Pencil, Plus } from "lucide-react";
import { locations } from "@/lib/mock-data";
import { formatBRL } from "@/lib/utils";

export default function LocaisPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Locais de plantão</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Defina o valor padrão de cada hospital ou clínica — usado automaticamente no calendário
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Novo local
        </button>
      </header>

      <ul className="space-y-3">
        {locations.map((loc) => (
          <li
            key={loc.id}
            className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${loc.color}22`, color: loc.color }}
              >
                <MapPin className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="font-semibold">{loc.name}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Valor padrão por plantão:{" "}
                  <span className="font-medium text-[var(--color-foreground)]">
                    {formatBRL(loc.defaultRate)}
                  </span>
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface-elevated)] sm:self-center"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Editar
            </button>
          </li>
        ))}
      </ul>

      <p className="text-sm text-[var(--color-muted)]">
        Dica: ao registrar um plantão, você só escolhe o local e a data — o valor entra na renda do mês
        sem digitar de novo.
      </p>
    </div>
  );
}
