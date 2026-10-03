"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import { Field, TextInput } from "@/components/form-field";
import type { ShiftLocation } from "@/lib/types";
import { loadLocations, parseMoney, saveLocations } from "@/lib/records";
import { countMatches, rematchImportedShifts } from "@/lib/shifts-store";
import { formatBRL } from "@/lib/utils";

const COLORS = ["#3b9eff", "#34d399", "#a78bfa", "#fbbf24", "#f87171", "#22d3ee"];

const blank = { name: "", codes: "", rate: "" };

function parseCodes(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,;\n]/)
        .map((code) => code.trim())
        .filter(Boolean),
    ),
  );
}

export default function LocaisPage() {
  const [list, setList] = useState<ShiftLocation[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function refreshCounts(locations: ShiftLocation[]) {
    setCounts(Object.fromEntries(locations.map((location) => [location.id, countMatches(location)])));
  }

  useEffect(() => {
    const loaded = loadLocations();
    setList(loaded);
    refreshCounts(loaded);
    const code = new URLSearchParams(window.location.search).get("codigo");
    if (code) setForm({ name: code, codes: code, rate: "" });
  }, []);

  function persist(next: ShiftLocation[], message: string) {
    setList(next);
    saveLocations(next);
    rematchImportedShifts(next);
    refreshCounts(next);
    setNotice(message);
    setError("");
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const rate = parseMoney(form.rate);
    if (!form.name.trim() || !Number.isFinite(rate) || rate <= 0) {
      setError("Informe o nome e um valor maior que zero.");
      setNotice("");
      return;
    }
    const codes = parseCodes(form.codes);
    if (editingId) {
      persist(
        list.map((item) =>
          item.id === editingId ? { ...item, name: form.name.trim(), codes, defaultRate: rate } : item,
        ),
        "Plantão atualizado. A agenda já foi reconhecida de novo.",
      );
    } else {
      persist(
        [
          ...list,
          {
            id: crypto.randomUUID(),
            name: form.name.trim(),
            codes,
            defaultRate: rate,
            color: COLORS[list.length % COLORS.length],
          },
        ],
        "Plantão cadastrado. Os compromissos com esse código já entram com o valor.",
      );
    }
    setForm(blank);
    setEditingId(null);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Plantões e valores</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Cadastre cada tipo de plantão com o código que você usa no Google Agenda. Todo compromisso com esse código
          entra na{" "}
          <Link href="/agenda" className="text-[var(--color-accent)] hover:underline">
            Agenda
          </Link>{" "}
          como plantão, com o valor.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:grid-cols-3"
      >
        <Field label="Nome do plantão">
          <TextInput
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
        </Field>
        <Field label="Códigos na agenda">
          <TextInput
            value={form.codes}
            onChange={(event) => setForm((current) => ({ ...current, codes: event.target.value }))}
          />
        </Field>
        <Field label="Valor do plantão">
          <TextInput
            inputMode="decimal"
            value={form.rate}
            onChange={(event) => setForm((current) => ({ ...current, rate: event.target.value }))}
            required
          />
        </Field>
        <p className="text-xs text-[var(--color-muted)] sm:col-span-3">
          Códigos: escreva como aparece no título do compromisso, separados por vírgula, por exemplo SAMU 19, SAMU 7. Se
          ficar vazio, o nome do plantão é usado como código.
        </p>
        {error ? <p className="text-sm text-[var(--color-danger)] sm:col-span-3">{error}</p> : null}
        {notice ? <p className="text-sm text-[var(--color-success)] sm:col-span-3">{notice}</p> : null}
        <div className="flex gap-3 sm:col-span-3">
          <button
            type="submit"
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            {editingId ? "Salvar alteração" : "Cadastrar plantão"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(blank);
              }}
              className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <ul className="space-y-3">
        {list.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-[var(--color-border)] p-5 text-sm text-[var(--color-muted)]">
            Nenhum plantão cadastrado ainda.
          </li>
        ) : null}
        {list.map((location) => (
          <li
            key={location.id}
            className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${location.color}22`, color: location.color }}
              >
                <MapPin className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="font-semibold">{location.name}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Valor por plantão:{" "}
                  <span className="font-medium text-[var(--color-foreground)]">
                    {formatBRL(location.defaultRate)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Códigos: {(location.codes?.length ? location.codes : [location.name]).join(", ")} ·{" "}
                  {counts[location.id] ?? 0} na agenda
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingId(location.id);
                  setForm({
                    name: location.name,
                    codes: (location.codes ?? []).join(", "),
                    rate: String(location.defaultRate).replace(".", ","),
                  });
                  setNotice("");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm"
              >
                <Pencil className="h-4 w-4" aria-hidden />
                Editar
              </button>
              <button
                type="button"
                onClick={() => persist(list.filter((item) => item.id !== location.id), "Plantão removido.")}
                className="inline-flex items-center rounded-xl border border-[var(--color-border)] px-3 py-2 text-[var(--color-danger)]"
                aria-label={`Remover ${location.name}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
