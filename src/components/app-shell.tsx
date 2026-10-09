"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  MapPin,
  PieChart,
  Receipt,
  Scale,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { InstallApp } from "@/components/install-app";
import { loadOwner, type Person } from "@/lib/people";
import { DATA_EVENT } from "@/lib/records";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/balanco", label: "Balanço", icon: Scale },
  { href: "/carteira", label: "Carteira", icon: PieChart },
  { href: "/cadastro/pessoas", label: "Meus dados e pessoas", icon: UserRound },
  { href: "/cadastro/familia", label: "Inclusão da família", icon: Users },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/locais", label: "Plantões e valores", icon: MapPin },
  { href: "/gastos", label: "Gastos", icon: Receipt },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [owner, setOwner] = useState<Person | null>(null);

  useEffect(() => {
    const refresh = () => setOwner(loadOwner());
    refresh();
    window.addEventListener(DATA_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(DATA_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [pathname]);

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex">
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
            <PieChart className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">MedPlant</p>
            <p className="text-xs text-[var(--color-muted)]">Finanças e investimentos</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-foreground)]",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 border-t border-[var(--color-border)] p-4">
          <InstallApp />
          <Link
            href="/cadastro/pessoas"
            className="flex items-center gap-3 rounded-xl bg-[var(--color-surface-elevated)] px-3 py-3 hover:opacity-90"
          >
            <Wallet className="h-4 w-4 text-[var(--color-muted)]" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{owner ? owner.nome : "Fazer meu cadastro"}</p>
              <p className="truncate text-xs text-[var(--color-muted)]">{owner ? owner.email : "Nenhum dado ainda"}</p>
            </div>
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-background)]/90 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-[var(--color-accent)]" aria-hidden />
            <span className="font-semibold">MedPlant</span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <InstallApp compact />
            <Link href="/cadastro/pessoas" className="max-w-[40vw] truncate text-xs text-[var(--color-muted)]">
              {owner ? owner.nome : "Fazer meu cadastro"}
            </Link>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)] px-2 py-2 lg:hidden">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
                  active
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "text-[var(--color-muted)]",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
