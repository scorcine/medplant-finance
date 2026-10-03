import { cn, formatBRL } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Props = {
  title: string;
  value: number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  valueFormat?: "currency" | "number";
  className?: string;
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend = "neutral",
  valueFormat = "currency",
  className,
}: Props) {
  const display =
    valueFormat === "number" ? String(value) : formatBRL(value);
  const trendColor =
    trend === "up"
      ? "text-[var(--color-success)]"
      : trend === "down"
        ? "text-[var(--color-danger)]"
        : "text-[var(--color-muted)]";

  return (
    <article
      className={cn(
        "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--color-muted)]">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{display}</p>
          {subtitle ? <p className={cn("mt-1 text-xs", trendColor)}>{subtitle}</p> : null}
        </div>
        <div className="rounded-xl bg-[var(--color-surface-elevated)] p-3 text-[var(--color-accent)]">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </article>
  );
}
