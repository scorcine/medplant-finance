"use client";

import { useEffect, useState } from "react";
import { CalendarArrowDown, Plus } from "lucide-react";
import { loadLocations } from "@/lib/records";
import {
  loadCalendars,
  replaceCalendarShifts,
  saveCalendars,
  shiftsFromIcs,
  type AgendaCalendar,
} from "@/lib/shifts-store";
import type { Shift } from "@/lib/mock-data";

const EXTRA_COLORS = ["#7c3aed", "#f97316", "#3b9eff", "#34d399", "#f43f5e"];

type Props = {
  onImported: (shifts: Shift[]) => void;
};

export function ImportAgenda({ onImported }: Props) {
  const [calendars, setCalendars] = useState<AgendaCalendar[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    setCalendars(loadCalendars());
  }, []);

  function update(next: AgendaCalendar[]) {
    setCalendars(next);
    saveCalendars(next);
  }

  function apply(calendar: AgendaCalendar, ics: string) {
    const imported = shiftsFromIcs(ics, loadLocations(), calendar);
    if (imported.length === 0) {
      setError(`Nenhum compromisso em ${calendar.name}.`);
      setMessage("");
      return;
    }
    const saved = replaceCalendarShifts(calendar.id, imported);
    onImported(saved);
    const matched = imported.filter((shift) => shift.locationId).length;
    setError("");
    setMessage(
      `${calendar.name}: ${imported.length} compromisso${imported.length === 1 ? "" : "s"}, ${matched} com valor do local.`,
    );
  }

  async function pull(calendar: AgendaCalendar) {
    if (!calendar.url.trim()) {
      setError(`Cole o endereço iCal de ${calendar.name}.`);
      return;
    }
    setLoadingId(calendar.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: calendar.url }),
      });
      const data = (await response.json()) as { ics?: string; error?: string };
      if (!response.ok || !data.ics) {
        setError(data.error ?? `Não foi possível puxar ${calendar.name}.`);
        return;
      }
      apply(calendar, data.ics);
    } catch {
      setError(`Não foi possível puxar ${calendar.name}.`);
    } finally {
      setLoadingId("");
    }
  }

  async function pullAll() {
    const withUrl = calendars.filter((calendar) => calendar.url.trim());
    if (withUrl.length === 0) {
      setError("Cole pelo menos um endereço iCal.");
      return;
    }
    for (const calendar of withUrl) {
      await pull(calendar);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start gap-3">
        <CalendarArrowDown className="mt-0.5 h-5 w-5 text-[var(--color-accent)]" aria-hidden />
        <div>
          <h2 className="font-semibold">Agendas do Chrome</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Cada pessoa tem a própria agenda, como no Google Agenda. A sua fica roxa e a da sua esposa, laranja. O valor do plantão entra para quem é dono da agenda.
          </p>
        </div>
      </div>

      <ul className="mt-5 space-y-4">
        {calendars.map((calendar) => (
          <li key={calendar.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: calendar.color }} aria-hidden />
              <input
                value={calendar.name}
                aria-label="Nome da agenda"
                onChange={(event) =>
                  update(calendars.map((item) => (item.id === calendar.id ? { ...item, name: event.target.value } : item)))
                }
                className="min-w-40 flex-1 bg-transparent text-sm font-medium outline-none"
              />
            </div>
            <label className="mt-3 block text-xs text-[var(--color-muted)]" htmlFor={`url-${calendar.id}`}>
              Endereço secreto iCal
            </label>
            <input
              id={`url-${calendar.id}`}
              value={calendar.url}
              onChange={(event) =>
                update(calendars.map((item) => (item.id === calendar.id ? { ...item, url: event.target.value } : item)))
              }
              placeholder="https://calendar.google.com/calendar/ical/..."
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => pull(calendar)}
                disabled={loadingId === calendar.id}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: calendar.color }}
              >
                {loadingId === calendar.id ? "Puxando..." : "Puxar esta agenda"}
              </button>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-muted)]">
                Arquivo .ics
                <input
                  type="file"
                  accept=".ics,text/calendar"
                  className="sr-only"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (file) apply(calendar, await file.text());
                  }}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={pullAll}
          disabled={Boolean(loadingId)}
          className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Puxar todas as agendas
        </button>
        <button
          type="button"
          onClick={() =>
            update([
              ...calendars,
              {
                id: crypto.randomUUID(),
                name: "Outra pessoa",
                color: EXTRA_COLORS[calendars.length % EXTRA_COLORS.length],
                url: "",
              },
            ])
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Adicionar agenda
        </button>
      </div>
      <p className="mt-3 text-xs text-[var(--color-muted)]">
        Google Agenda → Configurações do calendário → Integrar calendário → Endereço secreto no formato iCal. Use um endereço para cada pessoa.
      </p>
      {message ? <p className="mt-3 text-sm text-[var(--color-success)]">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
    </section>
  );
}
