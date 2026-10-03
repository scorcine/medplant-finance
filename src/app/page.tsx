"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CalendarCheck, PieChart, PiggyBank, TrendingUp, UserRound, Users } from "lucide-react";
import { ScopeToggle } from "@/components/scope-toggle";
import { StatCard } from "@/components/stat-card";
import {
  expenses,
  locations,
  monthExpenses,
  monthShiftIncome,
  shifts,
  shiftAmount,
  type Shift,
  type ViewScope,
} from "@/lib/mock-data";
import { loadImportedShifts, mergeShifts } from "@/lib/shifts-store";
import { formatBRL } from "@/lib/utils";

const MONTH = "2026-10";

export default function DashboardPage() {
  const [scope, setScope] = useState<ViewScope>("consolidado");
  const [agenda, setAgenda] = useState<Shift[]>(shifts);

  useEffect(() => {
    setAgenda(mergeShifts(loadImportedShifts()));
  }, []);

  const shiftIncome = monthShiftIncome(MONTH, agenda);
  const spent = monthExpenses(MONTH, scope);
  const balance = shiftIncome - spent;

  const byLocation = useMemo(() => {
    return locations.map((loc) => {
      const locShifts = agenda.filter((s) => s.date.startsWith(MONTH) && s.locationId === loc.id);
      const total = locShifts.reduce((sum, s) => sum + shiftAmount(s), 0);
      return { loc, count: locShifts.length, total };
    });
  }, [agenda]);

  const recentExpenses = expenses.slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-[var(--color-muted)]">Outubro 2026</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Visão geral</h1>
        </div>
        <ScopeToggle value={scope} onChange={setScope} />
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/carteira"
          className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:bg-[var(--color-surface-elevated)]"
        >
          <PieChart className="h-5 w-5 text-[var(--color-accent)]" aria-hidden />
          <span>
            <span className="block font-medium">Carteira de investimentos</span>
            <span className="block text-sm text-[var(--color-muted)]">Alocação e resultado</span>
          </span>
        </Link>
        <Link
          href="/cadastro/pessoas"
          className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:bg-[var(--color-surface-elevated)]"
        >
          <UserRound className="h-5 w-5 text-[var(--color-accent)]" aria-hidden />
          <span>
            <span className="block font-medium">Cadastro de pessoas</span>
            <span className="block text-sm text-[var(--color-muted)]">Titular e familiares</span>
          </span>
        </Link>
        <Link
          href="/cadastro/familia"
          className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:bg-[var(--color-surface-elevated)]"
        >
          <Users className="h-5 w-5 text-[var(--color-accent)]" aria-hidden />
          <span>
            <span className="block font-medium">Inclusão da família</span>
            <span className="block text-sm text-[var(--color-muted)]">Escolher quem entra no grupo</span>
          </span>
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Renda (plantões)"
          value={shiftIncome}
          subtitle="+2 plantões vs mês anterior"
          icon={TrendingUp}
          trend="up"
        />
        <StatCard
          title={scope === "pessoal" ? "Gastos pessoais" : scope === "familia" ? "Gastos família" : "Gastos totais"}
          value={spent}
          subtitle="Inclui cartão e fixos"
          icon={ArrowDownRight}
          trend="down"
        />
        <StatCard
          title="Saldo do mês"
          value={balance}
          subtitle={balance >= 0 ? "Dentro da meta" : "Atenção ao déficit"}
          icon={PiggyBank}
          trend={balance >= 0 ? "up" : "down"}
        />
        <StatCard
          title="Plantões agendados"
          value={agenda.filter((s) => s.date.startsWith(MONTH)).length}
          subtitle="3 a receber"
          icon={CalendarCheck}
          trend="neutral"
          valueFormat="number"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Renda por local</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Valores aplicados automaticamente ao cadastrar o plantão
          </p>
          <ul className="mt-5 space-y-4">
            {byLocation.map(({ loc, count, total }) => (
              <li key={loc.id}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: loc.color }}
                      aria-hidden
                    />
                    {loc.name}
                  </span>
                  <span className="font-medium">{formatBRL(total)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-elevated)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: shiftIncome ? `${(total / shiftIncome) * 100}%` : "0%",
                      backgroundColor: loc.color,
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {count} plantão{count !== 1 ? "ões" : ""} · padrão {formatBRL(loc.defaultRate)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Últimos gastos</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Filtrados pela visão selecionada</p>
          <ul className="mt-5 divide-y divide-[var(--color-border)]">
            {recentExpenses
              .filter((e) => {
                if (scope === "pessoal") return e.scope === "pessoal";
                if (scope === "familia") return e.scope === "familia";
                return true;
              })
              .map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.description}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {e.category} · {e.scope === "familia" ? "Família" : "Pessoal"} · {e.payment}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-[var(--color-danger)]">
                    −{formatBRL(e.amount)}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/50 p-5">
        <div className="flex items-start gap-3">
          <ArrowUpRight className="mt-0.5 h-5 w-5 text-[var(--color-accent)]" aria-hidden />
          <div>
            <h2 className="font-semibold">Próximo passo</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Esta interface usa dados de demonstração. Depois conectamos banco de dados e login para
              persistir plantões, locais e gastos na nuvem (Vercel + Supabase ou similar).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
