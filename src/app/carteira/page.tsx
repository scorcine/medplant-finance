"use client";

import { PieChart } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { formatBRL } from "@/lib/utils";

const positions = [
  { id: "1", nome: "Tesouro IPCA+ 2029", classe: "Renda fixa", aplicado: 40000, atual: 43820 },
  { id: "2", nome: "CDB 110% CDI", classe: "Renda fixa", aplicado: 20000, atual: 21350 },
  { id: "3", nome: "IVVB11", classe: "Exterior", aplicado: 15000, atual: 17240 },
  { id: "4", nome: "WEGE3", classe: "Ações", aplicado: 8000, atual: 9120 },
  { id: "5", nome: "MXRF11", classe: "FIIs", aplicado: 12000, atual: 11480 },
];

const classes = ["Renda fixa", "Ações", "FIIs", "Exterior"];

export default function CarteiraPage() {
  const aplicado = positions.reduce((sum, item) => sum + item.aplicado, 0);
  const atual = positions.reduce((sum, item) => sum + item.atual, 0);
  const resultado = atual - aplicado;
  const rentabilidade = (resultado / aplicado) * 100;

  const byClass = classes.map((classe) => {
    const total = positions.filter((item) => item.classe === classe).reduce((sum, item) => sum + item.atual, 0);
    return { classe, total, share: (total / atual) * 100 };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <PieChart className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Carteira de investimentos</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Patrimônio, resultado e quanto cada classe representa da carteira.
          </p>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Patrimônio atual" value={atual} subtitle="Soma das posições" icon={PieChart} trend="up" />
        <StatCard title="Valor aplicado" value={aplicado} subtitle="Aportes acumulados" icon={PieChart} />
        <StatCard
          title="Resultado"
          value={resultado}
          subtitle={`${rentabilidade >= 0 ? "+" : ""}${rentabilidade.toFixed(1)}% sobre o aplicado`}
          icon={PieChart}
          trend={resultado >= 0 ? "up" : "down"}
        />
        <StatCard title="Posições" value={positions.length} subtitle="Ativos na carteira" icon={PieChart} valueFormat="number" />
      </section>

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
          <h2 className="px-5 pt-5 text-lg font-semibold">Posições</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th className="px-5 py-3 font-medium">Ativo</th>
                  <th className="px-5 py-3 font-medium">Classe</th>
                  <th className="px-5 py-3 text-right font-medium">Aplicado</th>
                  <th className="px-5 py-3 text-right font-medium">Atual</th>
                  <th className="px-5 py-3 text-right font-medium">Resultado</th>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
