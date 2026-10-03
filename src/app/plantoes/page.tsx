"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { getLocation, locations, shifts, shiftAmount } from "@/lib/mock-data";
import { cn, formatBRL } from "@/lib/utils";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function PlantoesPage() {
  const [year] = useState(2026);
  const [month] = useState(9);
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1),
  );

  function dateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Calendário de plantões</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Toque em um dia para ver plantões · valor vem do local cadastrado
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Novo plantão
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <button type="button" className="rounded-lg p-2 text-[var(--color-muted)] hover:bg-[var(--color-surface-elevated)]" aria-label="Mês anterior">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold capitalize">{monthLabel}</h2>
            <button type="button" className="rounded-lg p-2 text-[var(--color-muted)] hover:bg-[var(--color-surface-elevated)]" aria-label="Próximo mês">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-[var(--color-muted)]">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="min-h-[4.5rem] rounded-xl" />;
              }
              const key = dateKey(day);
              const dayShifts = shifts.filter((s) => s.date === key);
              const isToday = key === "2026-10-03";
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-[4.5rem] rounded-xl border border-transparent p-1.5 transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)]",
                    isToday && "ring-1 ring-[var(--color-accent)]",
                  )}
                >
                  <span className={cn("text-xs font-medium", isToday && "text-[var(--color-accent)]")}>
                    {day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayShifts.map((s) => {
                      const loc = getLocation(s.locationId);
                      return (
                        <div
                          key={s.id}
                          className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: loc?.color ?? "#555" }}
                          title={`${loc?.name} · ${formatBRL(shiftAmount(s))}`}
                        >
                          {loc?.name.split(" ")[0]}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="font-semibold">Próximos plantões</h2>
            <ul className="mt-4 space-y-3">
              {shifts
                .filter((s) => s.date >= "2026-10-03")
                .slice(0, 5)
                .map((s) => {
                  const loc = getLocation(s.locationId);
                  return (
                    <li
                      key={s.id}
                      className="flex items-start justify-between gap-2 rounded-xl bg-[var(--color-surface-elevated)] p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{loc?.name}</p>
                        <p className="text-xs text-[var(--color-muted)]">
                          {new Date(s.date + "T12:00:00").toLocaleDateString("pt-BR")} · {s.start}–{s.end}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatBRL(shiftAmount(s))}</p>
                        <p
                          className={cn(
                            "text-[10px] font-medium uppercase tracking-wide",
                            s.paid ? "text-[var(--color-success)]" : "text-[var(--color-warning)]",
                          )}
                        >
                          {s.paid ? "Pago" : "Pendente"}
                        </p>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="font-semibold">Legenda</h2>
            <ul className="mt-3 space-y-2">
              {locations.map((loc) => (
                <li key={loc.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: loc.color }} />
                    {loc.name}
                  </span>
                  <span className="text-[var(--color-muted)]">{formatBRL(loc.defaultRate)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
