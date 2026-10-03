"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Field, SelectInput, TextInput } from "@/components/form-field";
import { ImportAgenda } from "@/components/import-agenda";
import type { Shift, ShiftLocation } from "@/lib/types";
import { loadLocations, todayKey } from "@/lib/records";
import { addShift, loadCalendars, loadImportedShifts, mergeShifts, saveImportedShifts, type AgendaCalendar } from "@/lib/shifts-store";
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

export default function AgendaPage() {
  const today = todayKey();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [agenda, setAgenda] = useState<Shift[]>([]);
  const [places, setPlaces] = useState<ShiftLocation[]>([]);
  const [calendars, setCalendars] = useState<AgendaCalendar[]>([]);
  const [focus, setFocus] = useState("juntos");
  const [selectedDay, setSelectedDay] = useState(today);
  const [draft, setDraft] = useState({ date: today, start: "19:00", end: "07:00", locationId: "" });
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const loadedPlaces = loadLocations();
    setPlaces(loadedPlaces);
    setDraft((current) => ({ ...current, locationId: current.locationId || loadedPlaces[0]?.id || "" }));
    setCalendars(loadCalendars());
    setAgenda(mergeShifts(loadImportedShifts()));
  }, []);

  function placeOf(id: string) {
    return places.find((place) => place.id === id);
  }

  function labelOf(shift: Shift) {
    return placeOf(shift.locationId)?.name ?? shift.title ?? "Compromisso";
  }

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

  const visible = focus === "juntos" ? agenda : agenda.filter((shift) => shift.calendarId === focus);
  const dayItems = visible
    .filter((shift) => shift.date === selectedDay)
    .sort((a, b) => a.start.localeCompare(b.start));
  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Agenda</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Compromissos de cada um e de todos juntos. O plantão ganha valor pelo local.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFocus("juntos")}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium",
              focus === "juntos" ? "bg-[var(--color-accent)] text-white" : "border border-[var(--color-border)] text-[var(--color-muted)]",
            )}
          >
            Juntos
          </button>
          {calendars.map((calendar) => (
            <button
              key={calendar.id}
              type="button"
              onClick={() => setFocus(calendar.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium",
                focus === calendar.id ? "text-white" : "border border-[var(--color-border)] text-[var(--color-muted)]",
              )}
              style={focus === calendar.id ? { backgroundColor: calendar.color } : undefined}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: calendar.color }} aria-hidden />
              {calendar.name}
            </button>
          ))}
        </div>
      </header>

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
              if (day === null) return <div key={`empty-${index}`} className="min-h-[5rem] rounded-xl" />;
              const key = dateKey(day);
              const dayShifts = visible.filter((shift) => shift.date === key);
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSelectedDay(key)}
                  className={cn(
                    "min-h-[5rem] rounded-xl border p-1.5 text-left transition-colors hover:bg-[var(--color-surface-elevated)]",
                    key === selectedDay ? "border-[var(--color-accent)]" : "border-transparent",
                  )}
                >
                  <span className={cn("text-xs font-medium", key === today && "text-[var(--color-accent)]")}>{day}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayShifts.slice(0, 3).map((shift) => (
                      <div
                        key={shift.id}
                        className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: shift.color ?? placeOf(shift.locationId)?.color ?? "#64748b" }}
                        title={`${shift.ownerName ? `${shift.ownerName} · ` : ""}${labelOf(shift)}`}
                      >
                        {labelOf(shift)}
                      </div>
                    ))}
                    {dayShifts.length > 3 ? (
                      <p className="text-[10px] text-[var(--color-muted)]">+{dayShifts.length - 3}</p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="font-semibold">
              {new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h2>
            <ul className="mt-4 space-y-3">
              {dayItems.length === 0 ? (
                <li className="text-sm text-[var(--color-muted)]">Nenhum compromisso neste dia.</li>
              ) : (
                dayItems.map((shift) => {
                  const location = placeOf(shift.locationId);
                  return (
                    <li key={shift.id} className="rounded-xl bg-[var(--color-surface-elevated)] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-medium">
                            {shift.color ? (
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: shift.color }} aria-hidden />
                            ) : null}
                            {labelOf(shift)}
                          </p>
                          <p className="text-xs text-[var(--color-muted)]">
                            {shift.ownerName ? `${shift.ownerName} · ` : ""}
                            {shift.start}–{shift.end}
                          </p>
                        </div>
                        {location ? <p className="text-sm font-semibold">{formatBRL(location.defaultRate)}</p> : null}
                      </div>
                      {shift.id.startsWith("gcal-") && !location && places.length > 0 ? (
                        <label className="mt-2 block text-xs text-[var(--color-muted)]">
                          É plantão? Escolha o local para aplicar o valor
                          <select
                            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-sm text-[var(--color-foreground)]"
                            value={shift.locationId}
                            onChange={(event) => assignLocation(shift.id, event.target.value)}
                          >
                            <option value="">Não é plantão</option>
                            {places.map((item) => (
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
            <h2 className="font-semibold">Plantões no mês por pessoa</h2>
            <ul className="mt-3 space-y-2">
              {calendars.map((calendar) => {
                const items = agenda.filter(
                  (shift) =>
                    shift.calendarId === calendar.id && shift.date.startsWith(monthPrefix) && placeOf(shift.locationId),
                );
                const total = items.reduce((sum, shift) => sum + (placeOf(shift.locationId)?.defaultRate ?? 0), 0);
                return (
                  <li key={calendar.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: calendar.color }} />
                      {calendar.name} · {items.length}
                    </span>
                    <span className="font-medium">{formatBRL(total)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>

      {places.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-5 text-sm text-[var(--color-muted)]">
          Cadastre os locais de plantão com o valor para a agenda reconhecer os plantões pelo nome.{" "}
          <Link href="/locais" className="text-[var(--color-accent)] hover:underline">
            Cadastrar local
          </Link>
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.locationId) return;
            const saved = addShift({
              id: `manual-${crypto.randomUUID()}`,
              date: draft.date,
              start: draft.start,
              end: draft.end,
              locationId: draft.locationId,
              paid: false,
            });
            setAgenda(mergeShifts(saved));
            const place = placeOf(draft.locationId);
            setNotice(place ? `Plantão salvo com ${formatBRL(place.defaultRate)}.` : "Plantão salvo.");
          }}
          className="grid gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:grid-cols-4"
        >
          <h2 className="font-semibold md:col-span-4">Cadastrar plantão manualmente</h2>
          <Field label="Data">
            <TextInput type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} required />
          </Field>
          <Field label="Início">
            <TextInput type="time" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} required />
          </Field>
          <Field label="Fim">
            <TextInput type="time" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} required />
          </Field>
          <Field label="Local">
            <SelectInput value={draft.locationId} onChange={(event) => setDraft({ ...draft, locationId: event.target.value })}>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name} · {formatBRL(place.defaultRate)}
                </option>
              ))}
            </SelectInput>
          </Field>
          <div className="md:col-span-4 flex flex-wrap items-center gap-3">
            <button type="submit" className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white">
              Cadastrar plantão
            </button>
            <p className="text-sm text-[var(--color-muted)]">
              Valor automático: {formatBRL(placeOf(draft.locationId)?.defaultRate ?? 0)}
            </p>
            {notice ? <p className="text-sm text-[var(--color-success)]">{notice}</p> : null}
          </div>
        </form>
      )}

      <ImportAgenda
        onImported={(imported) => {
          setCalendars(loadCalendars());
          setAgenda(mergeShifts(imported));
        }}
      />
    </div>
  );
}
