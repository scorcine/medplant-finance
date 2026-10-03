"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, CalendarCheck, CheckCircle2, Circle, PiggyBank, TrendingUp } from "lucide-react";
import { ScopeToggle } from "@/components/scope-toggle";
import { StatCard } from "@/components/stat-card";
import { loadFamily, loadOwner, type Person } from "@/lib/people";
import { currentMonthKey, DATA_EVENT, loadExpenses, loadLocations } from "@/lib/records";
import { loadCalendars, loadImportedShifts, mergeShifts, type AgendaCalendar } from "@/lib/shifts-store";
import { monthExpenses, type Expense, type Shift, type ShiftLocation, type ViewScope } from "@/lib/types";
import { formatBRL } from "@/lib/utils";

export default function DashboardPage() {
  const month = currentMonthKey();
  const [scope, setScope] = useState<ViewScope>("consolidado");
  const [owner, setOwner] = useState<Person | null>(null);
  const [hasFamily, setHasFamily] = useState(false);
  const [agenda, setAgenda] = useState<Shift[]>([]);
  const [placeList, setPlaceList] = useState<ShiftLocation[]>([]);
  const [expenseList, setExpenseList] = useState<Expense[]>([]);
  const [memberCalendars, setMemberCalendars] = useState<AgendaCalendar[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setOwner(loadOwner());
      setHasFamily(loadFamily().membros.length > 1);
      setAgenda(mergeShifts(loadImportedShifts()));
      setPlaceList(loadLocations());
      setExpenseList(loadExpenses());
      setMemberCalendars(loadCalendars());
      setReady(true);
    };
    refresh();
    window.addEventListener(DATA_EVENT, refresh);
    return () => window.removeEventListener(DATA_EVENT, refresh);
  }, []);

  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date());
  const monthShifts = agenda.filter((shift) => shift.date.startsWith(month));
  const shiftIncome = monthShifts.reduce(
    (sum, shift) => sum + (placeList.find((place) => place.id === shift.locationId)?.defaultRate ?? 0),
    0,
  );
  const spent = monthExpenses(month, scope, expenseList);
  const balance = shiftIncome - spent;

  const byLocation = useMemo(
    () =>
      placeList
        .map((loc) => {
          const count = agenda.filter((shift) => shift.date.startsWith(month) && shift.locationId === loc.id).length;
          return { loc, count, total: count * loc.defaultRate };
        })
        .filter((item) => item.count > 0),
    [agenda, placeList, month],
  );

  const recentExpenses = expenseList
    .filter((expense) => {
      if (scope === "pessoal") return expense.scope === "pessoal";
      if (scope === "familia") return expense.scope === "familia";
      return true;
    })
    .slice(0, 6);

  const steps = [
    { done: Boolean(owner), label: "Fazer meu cadastro", href: "/cadastro/pessoas" },
    { done: hasFamily, label: "Ligar as pessoas da família", href: "/cadastro/familia" },
    { done: placeList.length > 0, label: "Cadastrar locais e valores do plantão", href: "/locais" },
    { done: agenda.length > 0, label: "Cadastrar ou puxar plantões", href: "/plantoes" },
    { done: expenseList.length > 0, label: "Lançar gastos", href: "/gastos" },
  ];
  const pending = steps.filter((step) => !step.done).length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm capitalize text-[var(--color-muted)]">{monthLabel}</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {owner ? `Olá, ${owner.nome.split(" ")[0]}` : "Visão geral"}
          </h1>
        </div>
        <ScopeToggle value={scope} onChange={setScope} />
      </header>

      {ready && pending > 0 ? (
        <section className="rounded-2xl border border-[var(--color-accent)]/40 bg-[var(--color-surface)] p-5">
          <h2 className="font-semibold">{owner ? "Complete a configuração" : "Comece pelo seu cadastro"}</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            O app começa vazio. Tudo o que aparece aqui vem do que você cadastrar.
          </p>
          <ul className="mt-4 space-y-2">
            {steps.map((step) => (
              <li key={step.href}>
                <Link href={step.href} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-[var(--color-surface-elevated)]">
                  {step.done ? (
                    <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" aria-hidden />
                  ) : (
                    <Circle className="h-4 w-4 text-[var(--color-muted)]" aria-hidden />
                  )}
                  <span className={step.done ? "text-[var(--color-muted)] line-through" : ""}>{step.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Renda de plantões no mês" value={shiftIncome} icon={TrendingUp} trend="up" />
        <StatCard
          title={scope === "pessoal" ? "Gastos pessoais" : scope === "familia" ? "Gastos da família" : "Gastos totais"}
          value={spent}
          icon={ArrowDownRight}
          trend="down"
        />
        <StatCard title="Saldo do mês" value={balance} icon={PiggyBank} trend={balance >= 0 ? "up" : "down"} />
        <StatCard title="Plantões no mês" value={monthShifts.length} icon={CalendarCheck} valueFormat="number" />
      </section>

      {memberCalendars.length > 0 ? (
        <Link
          href="/plantoes"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:bg-[var(--color-surface-elevated)]"
        >
          <p className="font-semibold">Calendário da família</p>
          <span className="flex flex-wrap items-center gap-3 text-sm font-medium">
            {memberCalendars.map((calendar) => (
              <span key={calendar.id} className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: calendar.color }} aria-hidden />
                {calendar.name}
              </span>
            ))}
            <span className="text-[var(--color-muted)]">Juntos</span>
          </span>
        </Link>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Renda por local</h2>
          {byLocation.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              Nenhum plantão neste mês.{" "}
              <Link href="/plantoes" className="text-[var(--color-accent)] hover:underline">
                Cadastrar plantão
              </Link>
            </p>
          ) : (
            <ul className="mt-5 space-y-4">
              {byLocation.map(({ loc, count, total }) => (
                <li key={loc.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: loc.color }} aria-hidden />
                      {loc.name}
                    </span>
                    <span className="font-medium">{formatBRL(total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-elevated)]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: shiftIncome ? `${(total / shiftIncome) * 100}%` : "0%", backgroundColor: loc.color }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {count} {count === 1 ? "plantão" : "plantões"} · {formatBRL(loc.defaultRate)} cada
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Últimos gastos</h2>
          {recentExpenses.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              Nenhum gasto lançado.{" "}
              <Link href="/gastos" className="text-[var(--color-accent)] hover:underline">
                Lançar gasto
              </Link>
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-[var(--color-border)]">
              {recentExpenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.description}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {e.category} · {e.scope === "familia" ? "Família" : "Pessoal"} · {e.payment}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-[var(--color-danger)]">−{formatBRL(e.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
