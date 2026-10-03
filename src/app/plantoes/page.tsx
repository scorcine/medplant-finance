"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ImportAgenda } from "@/components/import-agenda";
import { getLocation, locations, shiftAmount, type Shift } from "@/lib/mock-data";
import { loadImportedShifts, mergeShifts, saveImportedShifts } from "@/lib/shifts-store";
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

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function PlantoesPage() {
  const today = todayKey();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [agenda, setAgenda] = useState<Shift[]>([]);

  useEffect(() => {
    setAgenda(mergeShifts(loadImportedShifts()));
  }, []);

  const grid = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );

  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(cursor.year, cursor.month, 1),
  );

  function dateKey(day: number) {
    return `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function shiftCursor(delta: number) {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function assignLocation(id: string, locationId: string) {
    const imported = loadImportedShifts().map((shift) => (shift.id === id ? { ...shift, locationId } : shift));
    saveImportedShifts(imported);
    setAgenda(mergeShifts(imported));
  }

  const upcoming = agenda.filter((shift) => shift.date >= today).slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Calendário de plantões</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          O valor entra pelo local. Importe a agenda do Chrome para puxar os plantões cadastrados lá.
        </p>
      </header>

      <ImportAgenda onImported={(imported) => setAgenda(mergeShifts(imported))} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftCursor(-1)}
              className="rounded-lg p-2 text-[var(--color-muted)] hover:bg-[var(--color-surface-elevated)]"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold capitalize">{monthLabel}</h2>
            <button
              type="button"
              onClick={() => shiftCursor(1)}
              className="rounded-lg p-2 text-[var(--color-muted)] hover:bg-[var(--color-surface-elevated)]"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-[var(--color-muted)]">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((day, index) => {
              if (day === null) return <div key={`empty-${index}`} className="min-h-[4.5rem] rounded-xl" />;
              const key = dateKey(day);
              const dayShifts = agenda.filter((shift) => shift.date === key);
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-[4.5rem] rounded-xl border border-transparent p-1.5 transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)]",
                    key === today && "ring-1 ring-[var(--color-accent)]",
                  )}
                >
                  <span className={cn("text-xs font-medium", key === today && "text-[var(--color-accent)]")}>{day}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayShifts.map((shift) => {
                      const location = getLocation(shift.locationId);
                      return (
                        <div
                          key={shift.id}
                          className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: location?.color ?? "#64748b" }}
                          title={`${location?.name ?? shift.title ?? "Plantão"} · ${formatBRL(shiftAmount(shift))}`}
                        >
                          {location?.name.split(" ")[0] ?? "Agenda"}
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
              {upcoming.length === 0 ? (
                <li className="text-sm text-[var(--color-muted)]">Nenhum plantão a partir de hoje.</li>
              ) : (
                upcoming.map((shift) => {
                  const location = getLocation(shift.locationId);
                  return (
                    <li key={shift.id} className="rounded-xl bg-[var(--color-surface-elevated)] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{location?.name ?? shift.title ?? "Plantão da agenda"}</p>
                          <p className="text-xs text-[var(--color-muted)]">
                            {new Date(shift.date + "T12:00:00").toLocaleDateString("pt-BR")} · {shift.start}–{shift.end}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatBRL(shiftAmount(shift))}</p>
                          <p
                            className={cn(
                              "text-[10px] font-medium uppercase tracking-wide",
                              shift.paid ? "text-[var(--color-success)]" : "text-[var(--color-warning)]",
                            )}
                          >
                            {shift.paid ? "Pago" : "Pendente"}
                          </p>
                        </div>
                      </div>
                      {shift.id.startsWith("gcal-") && !location ? (
                        <label className="mt-2 block text-xs text-[var(--color-muted)]">
                          Local para aplicar o valor
                          <select
                            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-sm text-[var(--color-foreground)]"
                            value={shift.locationId}
                            onChange={(event) => assignLocation(shift.id, event.target.value)}
                          >
                            <option value="">Escolher local</option>
                            {locations.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} · {formatBRL(item.defaultRate)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="font-semibold">Legenda</h2>
            <ul className="mt-3 space-y-2">
              {locations.map((location) => (
                <li key={location.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: location.color }} />
                    {location.name}
                  </span>
                  <span className="text-[var(--color-muted)]">{formatBRL(location.defaultRate)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
