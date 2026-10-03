"use client";

import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { Field, SelectInput, TextInput } from "@/components/form-field";
import { parseFatura, type FaturaItem } from "@/lib/fatura";
import { loadFamily, loadOwner, loadPeople, type Person } from "@/lib/people";
import { currentMonthKey, loadExpenses, saveExpenses } from "@/lib/records";
import type { CreditCard, Expense } from "@/lib/types";
import { formatBRL } from "@/lib/utils";

type Props = {
  card: CreditCard;
  onDone: (message: string) => void;
  onCancel: () => void;
};

function clipToMonth(month: string, date: string) {
  if (date.startsWith(month)) return date;
  const [year, m] = month.split("-").map(Number);
  const last = new Date(year, m, 0).getDate();
  return `${month}-${String(Math.min(Number(date.slice(8, 10)) || 1, last)).padStart(2, "0")}`;
}

export function ImportFatura({ card, onDone, onCancel }: Props) {
  const [month, setMonth] = useState("");
  const [scope, setScope] = useState<Expense["scope"]>("pessoal");
  const [payers, setPayers] = useState<Person[]>([]);
  const [paidBy, setPaidBy] = useState("");
  const [items, setItems] = useState<FaturaItem[]>([]);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setMonth(currentMonthKey());
    const people = loadPeople();
    const familyIds = loadFamily().membros.map((member) => member.personId);
    const inFamily = people.filter((person) => familyIds.includes(person.id));
    setPayers(inFamily.length > 0 ? inFamily : people);
    setPaidBy(loadOwner()?.id ?? "");
    setExisting(new Set(loadExpenses().map((expense) => expense.importKey).filter((key): key is string => Boolean(key))));
  }, []);

  const keyOf = (item: FaturaItem) => `${card.id}|${item.key}`;
  const fresh = items.filter((item) => !existing.has(keyOf(item)));
  const total = fresh.reduce((sum, item) => sum + item.amount, 0);

  async function onFile(file: File) {
    setError("");
    const text = await file.text();
    const result = parseFatura(file.name, text);
    if (result.items.length === 0) {
      setItems([]);
      setError("Não encontrei compras nesse arquivo. Use o OFX ou CSV exportado pelo banco.");
      return;
    }
    setItems(result.items);
    const repeated = result.items.filter((item) => existing.has(keyOf(item))).length;
    const notes = [`${result.items.length} compras encontradas`];
    if (repeated) notes.push(`${repeated} já importadas antes`);
    if (result.ignored) notes.push(`${result.ignored} linhas ignoradas (pagamentos e estornos)`);
    setInfo(notes.join(" · "));
  }

  function confirm() {
    const created: Expense[] = fresh.map((item) => ({
      id: crypto.randomUUID(),
      date: clipToMonth(month, item.date),
      description: item.description,
      amount: item.amount,
      category: "Cartão",
      scope,
      payment: "credito",
      paidBy: paidBy || undefined,
      tipo: "cartao",
      cardId: card.id,
      parcelas: 1,
      importKey: keyOf(item),
    }));
    saveExpenses([...created, ...loadExpenses()]);
    onDone(`${created.length} lançamentos da fatura importados para ${card.name}, somando ${formatBRL(total)}.`);
  }

  return (
    <div className="mt-5 space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
      <p className="text-sm font-semibold">Importar fatura de {card.name}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Mês da fatura">
          <TextInput type="month" value={month} onChange={(event) => setMonth(event.target.value)} required />
        </Field>
        <Field label="Escopo">
          <SelectInput value={scope} onChange={(event) => setScope(event.target.value as Expense["scope"])}>
            <option value="pessoal">Pessoal</option>
            <option value="familia">Família</option>
          </SelectInput>
        </Field>
        <Field label="Quem pagou">
          <SelectInput value={paidBy} onChange={(event) => setPaidBy(event.target.value)}>
            {payers.length === 0 ? <option value="">Não informado</option> : null}
            {payers.map((person) => (
              <option key={person.id} value={person.id}>
                {person.nome}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-muted)] hover:border-[var(--color-accent)]">
        <Upload className="h-4 w-4" aria-hidden />
        Escolher arquivo da fatura (.ofx ou .csv)
        <input
          type="file"
          accept=".ofx,.qfx,.csv,.txt"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
      </label>
      {info ? <p className="text-xs text-[var(--color-muted)]">{info}</p> : null}
      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      {fresh.length > 0 ? (
        <>
          <ul className="max-h-64 divide-y divide-[var(--color-border)] overflow-y-auto text-sm">
            {fresh.map((item) => (
              <li key={item.key} className="flex justify-between gap-3 py-2">
                <span className="min-w-0 truncate">
                  <span className="text-[var(--color-muted)]">
                    {new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </span>{" "}
                  {item.description}
                </span>
                <span className="shrink-0 font-medium">{formatBRL(item.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={confirm}
              className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Importar {fresh.length} lançamentos · {formatBRL(total)}
            </button>
            <button type="button" onClick={onCancel} className="text-sm text-[var(--color-muted)]">
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={onCancel} className="text-sm text-[var(--color-muted)]">
          Fechar
        </button>
      )}
      <p className="text-xs text-[var(--color-muted)]">
        No app ou internet banking, abra a fatura e procure “Exportar”, “Baixar” ou “Salvar como OFX/CSV”. Compras
        parceladas entram com o valor da parcela daquela fatura. Importar o mesmo arquivo de novo não duplica.
      </p>
    </div>
  );
}
