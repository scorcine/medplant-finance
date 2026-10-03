import { CreditCard } from "lucide-react";
import { formatBRL } from "@/lib/utils";

const cards = [
  {
    id: "c1",
    name: "Nubank",
    last4: "4821",
    limit: 12000,
    invoice: 2847.4,
    closing: "08/10",
    due: "15/10",
  },
  {
    id: "c2",
    name: "Itaú",
    last4: "9033",
    limit: 8000,
    invoice: 612.5,
    closing: "02/10",
    due: "10/10",
  },
];

export default function CartoesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Cartões de crédito</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Faturas, limites e vencimentos (demonstração)
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => {
          const usage = (card.invoice / card.limit) * 100;
          return (
            <article
              key={card.id}
              className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface-elevated)] to-[var(--color-surface)] p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-[var(--color-muted)]">{card.name}</p>
                  <p className="mt-1 font-mono text-lg tracking-widest">•••• {card.last4}</p>
                </div>
                <CreditCard className="h-6 w-6 text-[var(--color-accent)]" aria-hidden />
              </div>
              <div className="mt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Fatura atual</span>
                  <span className="font-semibold">{formatBRL(card.invoice)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-background)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)]"
                    style={{ width: `${Math.min(usage, 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {usage.toFixed(0)}% do limite {formatBRL(card.limit)}
                </p>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-[var(--color-muted)]">Fechamento</dt>
                  <dd className="font-medium">{card.closing}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-muted)]">Vencimento</dt>
                  <dd className="font-medium">{card.due}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </div>
  );
}
