"use client";

import { useEffect, useState } from "react";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import { Field, TextInput } from "@/components/form-field";
import type { ShiftLocation } from "@/lib/mock-data";
import { loadLocations, parseMoney, saveLocations } from "@/lib/records";
import { formatBRL } from "@/lib/utils";

const COLORS = ["#3b9eff", "#34d399", "#a78bfa", "#fbbf24", "#f87171", "#22d3ee"];

const blank = { name: "", rate: "" };

export default function LocaisPage() {
  const [list, setList] = useState<ShiftLocation[]>([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setList(loadLocations());
  }, []);

  function persist(next: ShiftLocation[], message: string) {
    setList(next);
    saveLocations(next);
    setNotice(message);
    setError("");
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const rate = parseMoney(form.rate);
    if (!form.name.trim() || !Number.isFinite(rate) || rate <= 0) {
      setError("Informe o nome do local e um valor maior que zero.");
      setNotice("");
      return;
    }
    if (editingId) {
      persist(
        list.map((item) =>
          item.id === editingId ? { ...item, name: form.name.trim(), defaultRate: rate } : item,
        ),
        "Local atualizado neste navegador.",
      );
    } else {
      persist(
        [
          ...list,
          {
            id: crypto.randomUUID(),
            name: form.name.trim(),
            defaultRate: rate,
            color: COLORS[list.length % COLORS.length],
          },
        ],
        "Local cadastrado. O valor entra sozinho ao marcar o plantão.",
      );
    }
    setForm(blank);
    setEditingId(null);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Locais de plantão</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Cadastre o hospital e o valor. Esse valor é usado automaticamente no plantão.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:grid-cols-2"
      >
        <Field label="Nome do local">
          <TextInput
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Hospital Santa Clara"
            required
          />
        </Field>
        <Field label="Valor do plantão">
          <TextInput
            inputMode="decimal"
            value={form.rate}
            onChange={(event) => setForm((current) => ({ ...current, rate: event.target.value }))}
            placeholder="1300,00"
            required
          />
        </Field>
        {error ? <p className="text-sm text-[var(--color-danger)] sm:col-span-2">{error}</p> : null}
        {notice ? <p className="text-sm text-[var(--color-success)] sm:col-span-2">{notice}</p> : null}
        <div className="flex gap-3 sm:col-span-2">
          <button
            type="submit"
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            {editingId ? "Salvar alteração" : "Cadastrar local"}
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
                  Valor padrão por plantão:{" "}
                  <span className="font-medium text-[var(--color-foreground)]">
                    {formatBRL(location.defaultRate)}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingId(location.id);
                  setForm({ name: location.name, rate: String(location.defaultRate).replace(".", ",") });
                  setNotice("");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm"
              >
                <Pencil className="h-4 w-4" aria-hidden />
                Editar
              </button>
              <button
                type="button"
                onClick={() => persist(list.filter((item) => item.id !== location.id), "Local removido.")}
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
