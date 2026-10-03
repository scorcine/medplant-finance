"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarArrowDown, CheckCircle2, RefreshCw } from "lucide-react";
import { loadLocations } from "@/lib/records";
import {
  icalUrlFromEmail,
  loadCalendars,
  replaceCalendarShifts,
  saveSecretUrl,
  shiftsFromIcs,
  type AgendaCalendar,
} from "@/lib/shifts-store";
import type { Shift } from "@/lib/types";

type Props = {
  onImported: (shifts: Shift[]) => void;
};

type Status = { kind: "ok" | "erro" | "particular"; text: string };

export function ImportAgenda({ onImported }: Props) {
  const [calendars, setCalendars] = useState<AgendaCalendar[]>([]);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [loadingId, setLoadingId] = useState("");
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const autoPulled = useRef(false);

  function setCalendarStatus(id: string, value: Status) {
    setStatus((current) => ({ ...current, [id]: value }));
  }

  function apply(calendar: AgendaCalendar, ics: string) {
    const imported = shiftsFromIcs(ics, loadLocations(), calendar);
    if (imported.length === 0) {
      setCalendarStatus(calendar.id, { kind: "erro", text: "Nenhum compromisso nessa agenda." });
      return false;
    }
    onImported(replaceCalendarShifts(calendar.id, imported));
    const matched = imported.filter((shift) => shift.locationId).length;
    setCalendarStatus(calendar.id, {
      kind: "ok",
      text: `${imported.length} compromissos, ${matched} plantões com valor do local.`,
    });
    return true;
  }

  async function pull(calendar: AgendaCalendar) {
    const url = calendar.url.trim() || icalUrlFromEmail(calendar.email);
    setLoadingId(calendar.id);
    try {
      const response = await fetch("/api/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as { ics?: string; error?: string; code?: string };
      if (!response.ok || !data.ics) {
        setCalendarStatus(calendar.id, {
          kind: data.code === "particular" ? "particular" : "erro",
          text: data.error ?? "Não foi possível ler a agenda.",
        });
        setEditing((current) => ({ ...current, [calendar.id]: true }));
        return;
      }
      if (apply(calendar, data.ics)) {
        setEditing((current) => ({ ...current, [calendar.id]: false }));
      }
    } catch {
      setCalendarStatus(calendar.id, { kind: "erro", text: "Não foi possível ler a agenda." });
    } finally {
      setLoadingId("");
    }
  }

  useEffect(() => {
    const loaded = loadCalendars();
    setCalendars(loaded);
    if (autoPulled.current) return;
    autoPulled.current = true;
    (async () => {
      for (const calendar of loaded.filter((item) => item.url.trim())) {
        await pull(calendar);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (calendars.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="font-semibold">Conectar agendas</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Cadastre as pessoas com e-mail e marque quem entra na família. A agenda usa esses membros.
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
          <h2 className="font-semibold">Agendas conectadas</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            As agendas conectadas são atualizadas sozinhas sempre que você abre esta página.
          </p>
        </div>
      </div>
      <ul className="mt-5 space-y-3">
        {calendars.map((calendar) => {
          const connected = Boolean(calendar.url.trim());
          const open = editing[calendar.id] ?? !connected;
          const current = status[calendar.id];
          return (
            <li key={calendar.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: calendar.color }} aria-hidden />
                  <p className="font-medium">{calendar.name}</p>
                  <p className="text-sm text-[var(--color-muted)]">{calendar.email}</p>
                  {connected && !open ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--color-success)]">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      Conectada
                    </span>
                  ) : null}
                </div>
                {connected && !open ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => pull(calendar)}
                      disabled={loadingId === calendar.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      <RefreshCw className={loadingId === calendar.id ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden />
                      {loadingId === calendar.id ? "Atualizando" : "Atualizar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing((state) => ({ ...state, [calendar.id]: true }))}
                      className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)]"
                    >
                      Alterar conexão
                    </button>
                  </div>
                ) : null}
              </div>

              {open ? (
                <>
                  <label className="mt-3 block text-xs text-[var(--color-muted)]" htmlFor={`secret-${calendar.id}`}>
                    Endereço secreto iCal da agenda de {calendar.name}
                  </label>
                  <input
                    id={`secret-${calendar.id}`}
                    type="password"
                    autoComplete="off"
                    value={calendar.url}
                    onChange={(event) => {
                      saveSecretUrl(calendar.id, event.target.value.trim());
                      setCalendars(loadCalendars());
                    }}
                    placeholder="Cole aqui o endereço que termina em basic.ics"
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
                      {loadingId === calendar.id ? "Conectando..." : "Conectar agenda"}
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
                    {connected ? (
                      <button
                        type="button"
                        onClick={() => setEditing((state) => ({ ...state, [calendar.id]: false }))}
                        className="rounded-xl px-4 py-2 text-sm text-[var(--color-muted)]"
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}

              {current ? (
                <p
                  className={
                    current.kind === "ok"
                      ? "mt-2 text-xs text-[var(--color-muted)]"
                      : "mt-2 text-sm text-[var(--color-danger)]"
                  }
                >
                  {current.text}
                </p>
              ) : null}

              {current?.kind === "particular" ? (
                <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
                  <p className="font-semibold">Como pegar o endereço secreto de {calendar.name}</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-[var(--color-muted)]">
                    <li>
                      No computador, entrando com {calendar.email}, abra as{" "}
                      <a
                        href={`https://calendar.google.com/calendar/r/settings/calendar/${btoa(calendar.email)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--color-accent)] hover:underline"
                      >
                        configurações da agenda de {calendar.name}
                      </a>
                      .
                    </li>
                    <li>
                      Role até “Integrar agenda”, passe do botão “Personalizar” e copie o “Endereço secreto no formato
                      iCal”.
                    </li>
                    <li>Cole no campo acima e clique em “Conectar agenda”.</li>
                  </ol>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
