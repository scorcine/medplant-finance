"use client";

import { useEffect, useState } from "react";
import { PieChart, Trash2 } from "lucide-react";
import { Field, SelectInput, TextInput } from "@/components/form-field";
import { StatCard } from "@/components/stat-card";
import { loadPositions, parseMoney, savePositions } from "@/lib/records";
import type { Position } from "@/lib/types";
import { formatBRL } from "@/lib/utils";

const CLASSES = ["Renda fixa", "Ações", "FIIs", "Exterior", "Previdência", "Cripto", "Outros"];

const blank = { nome: "", classe: "Renda fixa", aplicado: "", atual: "" };

export default function CarteiraPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");

  useEffect(() => {
    setPositions(loadPositions());
  }, []);

  const aplicado = positions.reduce((sum, item) => sum + item.aplicado, 0);
  const atual = positions.reduce((sum, item) => sum + item.atual, 0);
  const resultado = atual - aplicado;
  const rentabilidade = aplicado > 0 ? (resultado / aplicado) * 100 : 0;

  const byClass = CLASSES.map((classe) => {
    const total = positions.filter((item) => item.classe === classe).reduce((sum, item) => sum + item.atual, 0);
    return { classe, total, share: atual > 0 ? (total / atual) * 100 : 0 };
  }).filter((item) => item.total > 0);

  function persist(next: Position[]) {
    setPositions(next);
    savePositions(next);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const valorAplicado = parseMoney(form.aplicado);
    const valorAtual = form.atual.trim() ? parseMoney(form.atual) : valorAplicado;
    if (!form.nome.trim() || !Number.isFinite(valorAplicado) || valorAplicado < 0 || !Number.isFinite(valorAtual)) {
      setError("Informe o ativo e o valor aplicado.");
      return;
    }
    persist([
      ...positions,
      { id: crypto.randomUUID(), nome: form.nome.trim(), classe: form.classe, aplicado: valorAplicado, atual: valorAtual },
    ]);
    setForm({ ...blank, classe: form.classe });
    setError("");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <PieChart className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Carteira de investimentos</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Cadastre seus investimentos para ver patrimônio, resultado e alocação.
          </p>
        </div>
      </header>

      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:grid-cols-4"
      >
        <Field label="Ativo" className="md:col-span-2">
          <TextInput value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
        </Field>
        <Field label="Classe">
          <SelectInput value={form.classe} onChange={(e) => setForm({ ...form, classe: e.target.value })}>
            {CLASSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Valor aplicado">
          <TextInput inputMode="decimal" value={form.aplicado} onChange={(e) => setForm({ ...form, aplicado: e.target.value })} required />
        </Field>
        <Field label="Valor atual" hint="Se deixar vazio, usa o valor aplicado.">
          <TextInput inputMode="decimal" value={form.atual} onChange={(e) => setForm({ ...form, atual: e.target.value })} />
        </Field>
        {error ? <p className="text-sm text-[var(--color-danger)] md:col-span-4">{error}</p> : null}
        <div className="md:col-span-4">
          <button type="submit" className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white">
            Adicionar investimento
          </button>
        </div>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Patrimônio atual" value={atual} icon={PieChart} />
        <StatCard title="Valor aplicado" value={aplicado} icon={PieChart} />
        <StatCard
          title="Resultado"
          value={resultado}
          subtitle={aplicado > 0 ? `${rentabilidade >= 0 ? "+" : ""}${rentabilidade.toFixed(1)}% sobre o aplicado` : undefined}
          icon={PieChart}
          trend={resultado >= 0 ? "up" : "down"}
        />
        <StatCard title="Investimentos" value={positions.length} icon={PieChart} valueFormat="number" />
      </section>

      {positions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-sm text-[var(--color-muted)]">
          Nenhum investimento cadastrado ainda.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="text-lg font-semibold">Alocação por classe</h2>
            <ul className="mt-5 space-y-4">
              {byClass.map((item) => (
                <li key={item.classe}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span>{item.classe}</span>
                    <span className="font-medium">
                      {item.share.toFixed(1)}% · {formatBRL(item.total)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-elevated)]">
                    <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${item.share}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <h2 className="px-5 pt-5 text-lg font-semibold">Investimentos</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                    <th className="px-5 py-3 font-medium">Ativo</th>
                    <th className="px-5 py-3 font-medium">Classe</th>
                    <th className="px-5 py-3 text-right font-medium">Aplicado</th>
                    <th className="px-5 py-3 text-right font-medium">Atual</th>
                    <th className="px-5 py-3 text-right font-medium">Resultado</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {positions.map((item) => {
                    const gain = item.atual - item.aplicado;
                    return (
                      <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="px-5 py-3 font-medium">{item.nome}</td>
                        <td className="px-5 py-3">{item.classe}</td>
                        <td className="px-5 py-3 text-right">{formatBRL(item.aplicado)}</td>
                        <td className="px-5 py-3 text-right">{formatBRL(item.atual)}</td>
                        <td
                          className={`px-5 py-3 text-right font-medium ${gain >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}
                        >
                          {gain >= 0 ? "+" : ""}
                          {formatBRL(gain)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => persist(positions.filter((position) => position.id !== item.id))}
                            aria-label={`Remover ${item.nome}`}
                          >
                            <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
