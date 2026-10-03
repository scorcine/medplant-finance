"use client";

import { useEffect, useState } from "react";
import { CalendarArrowDown } from "lucide-react";
import { loadAgendaUrl, saveAgendaUrl, saveImportedShifts, shiftsFromIcs } from "@/lib/shifts-store";
import type { Shift } from "@/lib/mock-data";

type Props = {
  onImported: (shifts: Shift[]) => void;
};

export function ImportAgenda({ onImported }: Props) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUrl(loadAgendaUrl());
  }, []);

  function apply(ics: string) {
    const imported = shiftsFromIcs(ics);
    if (imported.length === 0) {
      setError("Nenhum compromisso encontrado nessa agenda.");
      setMessage("");
      return;
    }
    saveImportedShifts(imported);
    onImported(imported);
    const matched = imported.filter((shift) => shift.locationId).length;
    setError("");
    setMessage(
      `${imported.length} compromisso${imported.length === 1 ? "" : "s"} puxado${imported.length === 1 ? "" : "s"}. ${matched} com valor do local.`,
    );
  }

  async function pullFromUrl() {
    setLoading(true);
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
        setError(data.error ?? "Não foi possível puxar a agenda.");
        return;
      }
      saveAgendaUrl(url.trim());
      apply(data.ics);
    } catch {
      setError("Não foi possível puxar a agenda.");
    } finally {
      setLoading(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setMessage("");
    apply(await file.text());
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start gap-3">
        <CalendarArrowDown className="mt-0.5 h-5 w-5 text-[var(--color-accent)]" aria-hidden />
        <div>
          <h2 className="font-semibold">Importar agenda do Chrome</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Cadastre o plantão no Google Agenda. O app puxa o compromisso e aplica o valor se o nome for de um local cadastrado.
          </p>
        </div>
      </div>

      <label className="mt-4 block text-sm font-medium" htmlFor="agenda-url">
        Endereço secreto iCal
      </label>
      <input
        id="agenda-url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://calendar.google.com/calendar/ical/..."
        className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        Google Agenda → Configurações do calendário → Integrar calendário → Endereço secreto no formato iCal.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={pullFromUrl}
          disabled={loading || !url.trim()}
          className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Puxando..." : "Puxar plantões"}
        </button>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface-elevated)]">
          Arquivo .ics
          <input
            type="file"
            accept=".ics,text/calendar"
            className="sr-only"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
        </label>
      </div>

      {message ? <p className="mt-3 text-sm text-[var(--color-success)]">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
    </section>
  );
}
