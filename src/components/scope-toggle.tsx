"use client";

import { cn } from "@/lib/utils";
import type { ViewScope } from "@/lib/mock-data";

const labels: { id: ViewScope; label: string }[] = [
  { id: "pessoal", label: "Pessoal" },
  { id: "familia", label: "Família" },
  { id: "consolidado", label: "Consolidado" },
];

type Props = {
  value: ViewScope;
  onChange: (v: ViewScope) => void;
  className?: string;
};

export function ScopeToggle({ value, onChange, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1",
        className,
      )}
      role="tablist"
      aria-label="Visão financeira"
    >
      {labels.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            value === id
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
