"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarArrowDown } from "lucide-react";
import { loadLocations } from "@/lib/records";
import {
  icalUrlFromEmail,
  loadCalendars,
  replaceCalendarShifts,
  saveSecretUrl,
  shiftsFromIcs,
  type AgendaCalendar,
} from "@/lib/shifts-store";
import type { Shift } from "@/lib/mock-data";

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

  function apply(calendar: AgendaCalendar, ics: string) {
    const imported = shiftsFromIcs(ics, loadLocations(), calendar);
    if (imported.length === 0) {
      setError(`Nenhum compromisso na agenda de ${calendar.email}.`);
      setMessage("");
      return;
    }
    onImported(replaceCalendarShifts(calendar.id, imported));
    const matched = imported.filter((shift) => shift.locationId).length;
    setError("");
    setMessage(`${calendar.name}: ${imported.length} compromissos, ${matched} com valor do local.`);
  }

  async function pull(calendar: AgendaCalendar) {
    const url = calendar.url.trim() || icalUrlFromEmail(calendar.email);
    setLoadingId(calendar.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as { ics?: string; error?: string };
      if (!response.ok || !data.ics) {
        setError(
          data.error ??
            `Não foi possível ler a agenda de ${calendar.email}. Se ela for particular, cole o endereço secreto iCal dessa conta.`,
        );
        return;
      }
      apply(calendar, data.ics);
    } catch {
      setError(`Não foi possível ler a agenda de ${calendar.email}.`);
    } finally {
      setLoadingId("");
    }
  }

  if (calendars.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="font-semibold">Calendário da família</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Cadastre as pessoas com e-mail e marque quem entra na família. O calendário usa esses membros.
        </p>
        <Link href="/cadastro/familia" className="mt-4 inline-flex text-sm text-[var(--color-accent)] hover:underline">
          Montar a família
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start gap-3">
        <CalendarArrowDown className="mt-0.5 h-5 w-5 text-[var(--color-accent)]" aria-hidden />
        <div>
          <h2 className="font-semibold">Calendários da família</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Cada membro entra pelo e-mail cadastrado. Dá para ver o seu, o de outra pessoa ou os dois juntos.
          </p>
        </div>
      </div>
      <ul className="mt-5 space-y-4">
        {calendars.map((calendar) => (
          <li key={calendar.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: calendar.color }} aria-hidden />
              <p className="font-medium">{calendar.name}</p>
              <p className="text-sm text-[var(--color-muted)]">{calendar.email}</p>
            </div>
            <label className="mt-3 block text-xs text-[var(--color-muted)]" htmlFor={`secret-${calendar.id}`}>
              Endereço secreto iCal, se a agenda for particular
            </label>
            <input
              id={`secret-${calendar.id}`}
              value={calendar.url}
              onChange={(event) => {
                const url = event.target.value;
                saveSecretUrl(calendar.id, url);
                setCalendars(loadCalendars());
              }}
              placeholder={icalUrlFromEmail(calendar.email)}
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
                {loadingId === calendar.id ? "Puxando..." : `Puxar agenda de ${calendar.email}`}
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
      {message ? <p className="mt-3 text-sm text-[var(--color-success)]">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
    </section>
  );
}
