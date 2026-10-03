"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, PieChart, RefreshCw, Trash2 } from "lucide-react";
import { Field, SelectInput, TextInput } from "@/components/form-field";
import { StatCard } from "@/components/stat-card";
import { loadPositions, parseMoney, savePositions } from "@/lib/records";
import type { Position } from "@/lib/types";
import { formatBRL } from "@/lib/utils";

const CLASSES = ["Ações", "FIIs", "ETFs", "BDRs", "Exterior", "Cripto", "Renda fixa", "Previdência", "Outros"];
const QUOTED = new Set(["Ações", "FIIs", "ETFs", "BDRs", "Exterior", "Cripto"]);
const STALE_MS = 15 * 60 * 1000;

const blank = { nome: "", classe: "Ações", quantidade: "", precoMedio: "", aplicado: "", atual: "" };

type QuoteResponse = {
  quotes?: Record<string, { priceBRL: number; changePct: number; time: string; name: string }>;
  missing?: string[];
  error?: string;
};

function toSymbol(ticker: string, classe: string) {
  const code = ticker.trim().toUpperCase();
  if (/[.\-=]/.test(code)) return code;
  if (classe === "Cripto") return `${code}-USD`;
  if (/^[A-Z]{4}\d{1,2}[A-Z]?$/.test(code)) return `${code}.SA`;
  return code;
}

function parseQty(value: string) {
  const text = value.trim();
  return /^\d{1,3}(\.\d{3})+$/.test(text) ? Number(text.replace(/\./g, "")) : parseMoney(text);
}

function formatQty(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 8 });
}

function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2).replace(".", ",")}%`;
}

export default function CarteiraPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [quoteInfo, setQuoteInfo] = useState("");
  const autoUpdated = useRef(false);

  const quoted = QUOTED.has(form.classe);

  const persist = useCallback((next: Position[]) => {
    setPositions(next);
    savePositions(next);
  }, []);

  const updateQuotes = useCallback(
    async (list: Position[]) => {
      const withTicker = list.filter((item) => item.ticker && item.quantidade);
      if (withTicker.length === 0) return;
      setUpdating(true);
      setQuoteInfo("");
      try {
        const symbols = withTicker.map((item) => toSymbol(item.ticker ?? "", item.classe));
        const response = await fetch(`/api/cotacoes?symbols=${encodeURIComponent(symbols.join(","))}`);
        const data = (await response.json()) as QuoteResponse;
        if (!response.ok || !data.quotes) {
          setQuoteInfo(data.error ?? "Não foi possível buscar as cotações agora.");
          return;
        }
        const quotes = data.quotes;
        const now = new Date().toISOString();
        const next = list.map((item) => {
          if (!item.ticker || !item.quantidade) return item;
          const quote = quotes[toSymbol(item.ticker, item.classe)];
          if (!quote) return item;
          return {
            ...item,
            preco: quote.priceBRL,
            variacaoDia: quote.changePct,
            atual: quote.priceBRL * item.quantidade,
            atualizadoEm: now,
          };
        });
        persist(next);
        const missing = withTicker
          .filter((item) => !quotes[toSymbol(item.ticker ?? "", item.classe)])
          .map((item) => item.ticker);
        setQuoteInfo(missing.length > 0 ? `Sem cotação para: ${missing.join(", ")}. Confira o código.` : "");
      } catch {
        setQuoteInfo("Não foi possível buscar as cotações agora.");
      } finally {
        setUpdating(false);
      }
    },
    [persist],
  );

  useEffect(() => {
    const loaded = loadPositions();
    setPositions(loaded);
    if (autoUpdated.current) return;
    autoUpdated.current = true;
    const last = loaded
      .filter((item) => item.ticker)
      .map((item) => (item.atualizadoEm ? new Date(item.atualizadoEm).getTime() : 0))
      .reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);
    if (Number.isFinite(last) && Date.now() - last > STALE_MS) void updateQuotes(loaded);
  }, [updateQuotes]);

  const aplicado = positions.reduce((sum, item) => sum + item.aplicado, 0);
  const atual = positions.reduce((sum, item) => sum + item.atual, 0);
  const resultado = atual - aplicado;
  const rentabilidade = aplicado > 0 ? (resultado / aplicado) * 100 : 0;
  const variacaoDia = positions.reduce((sum, item) => {
    if (!item.variacaoDia || !item.atual) return sum;
    return sum + item.atual - item.atual / (1 + item.variacaoDia / 100);
  }, 0);
  const lastUpdate = positions
    .map((item) => item.atualizadoEm)
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop();
  const hasTickers = positions.some((item) => item.ticker);

  const byClass = CLASSES.map((classe) => {
    const total = positions.filter((item) => item.classe === classe).reduce((sum, item) => sum + item.atual, 0);
    return { classe, total, share: atual > 0 ? (total / atual) * 100 : 0 };
  }).filter((item) => item.total > 0);

  function resetForm(classe = form.classe) {
    setForm({ ...blank, classe });
    setEditingId(null);
    setError("");
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nome = form.nome.trim();
    if (!nome) {
      setError(quoted ? "Informe o código do ativo." : "Informe o nome do investimento.");
      return;
    }
    let item: Position;
    if (quoted) {
      const quantidade = parseQty(form.quantidade);
      const precoMedio = parseMoney(form.precoMedio);
      if (!Number.isFinite(quantidade) || quantidade <= 0 || !Number.isFinite(precoMedio) || precoMedio < 0) {
        setError("Informe a quantidade e o preço médio.");
        return;
      }
      const previous = positions.find((position) => position.id === editingId);
      const ticker = nome.toUpperCase();
      const sameTicker = previous?.ticker === ticker;
      item = {
        id: editingId ?? crypto.randomUUID(),
        nome: ticker,
        ticker,
        classe: form.classe,
        quantidade,
        aplicado: quantidade * precoMedio,
        preco: sameTicker ? previous?.preco : undefined,
        variacaoDia: sameTicker ? previous?.variacaoDia : undefined,
        atualizadoEm: sameTicker ? previous?.atualizadoEm : undefined,
        atual: sameTicker && previous?.preco ? previous.preco * quantidade : quantidade * precoMedio,
      };
    } else {
      const valorAplicado = parseMoney(form.aplicado);
      const valorAtual = form.atual.trim() ? parseMoney(form.atual) : valorAplicado;
      if (!Number.isFinite(valorAplicado) || valorAplicado < 0 || !Number.isFinite(valorAtual)) {
        setError("Informe o valor aplicado.");
        return;
      }
      item = { id: editingId ?? crypto.randomUUID(), nome, classe: form.classe, aplicado: valorAplicado, atual: valorAtual };
    }
    const next = editingId
      ? positions.map((position) => (position.id === editingId ? item : position))
      : [...positions, item];
    persist(next);
    resetForm();
    if (item.ticker && !item.preco) void updateQuotes(next);
  }

  function startEdit(item: Position) {
    setEditingId(item.id);
    setError("");
    if (item.ticker && item.quantidade) {
      setForm({
        ...blank,
        nome: item.ticker,
        classe: item.classe,
        quantidade: String(item.quantidade).replace(".", ","),
        precoMedio: (item.aplicado / item.quantidade).toFixed(2).replace(".", ","),
      });
    } else {
      setForm({
        ...blank,
        nome: item.nome,
        classe: item.classe,
        aplicado: item.aplicado.toFixed(2).replace(".", ","),
        atual: item.atual.toFixed(2).replace(".", ","),
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
            <PieChart className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Carteira de investimentos</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Ações, FIIs, ETFs, BDRs, exterior e cripto são atualizados pela cotação do pregão.
            </p>
          </div>
        </div>
        {hasTickers ? (
          <div className="text-right">
            <button
              type="button"
              onClick={() => updateQuotes(positions)}
              disabled={updating}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm disabled:opacity-50"
            >
              <RefreshCw className={updating ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
              {updating ? "Atualizando cotações" : "Atualizar cotações"}
            </button>
            {lastUpdate ? (
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Atualizado em {new Date(lastUpdate).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </p>
            ) : null}
          </div>
        ) : null}
      </header>

      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:grid-cols-4"
      >
        <Field label="Classe">
          <SelectInput value={form.classe} onChange={(e) => setForm({ ...form, classe: e.target.value })}>
            {CLASSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field
          label={quoted ? "Código do ativo" : "Nome do investimento"}
          hint={quoted ? "Como na corretora: PETR4, HGLG11, IVVB11, AAPL, BTC." : undefined}
        >
          <TextInput value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
        </Field>
        {quoted ? (
          <>
            <Field label="Quantidade">
              <TextInput
                inputMode="decimal"
                value={form.quantidade}
                onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                required
              />
            </Field>
            <Field label="Preço médio (R$)">
              <TextInput
                inputMode="decimal"
                value={form.precoMedio}
                onChange={(e) => setForm({ ...form, precoMedio: e.target.value })}
                required
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Valor aplicado">
              <TextInput
                inputMode="decimal"
                value={form.aplicado}
                onChange={(e) => setForm({ ...form, aplicado: e.target.value })}
                required
              />
            </Field>
            <Field label="Valor atual" hint="Se deixar vazio, usa o valor aplicado.">
              <TextInput inputMode="decimal" value={form.atual} onChange={(e) => setForm({ ...form, atual: e.target.value })} />
            </Field>
          </>
        )}
        {error ? <p className="text-sm text-[var(--color-danger)] md:col-span-4">{error}</p> : null}
        <div className="flex gap-3 md:col-span-4">
          <button type="submit" className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white">
            {editingId ? "Salvar alteração" : "Adicionar investimento"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={() => resetForm()}
              className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      {quoteInfo ? <p className="text-sm text-[var(--color-warning)]">{quoteInfo}</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Patrimônio atual" value={atual} icon={PieChart} />
        <StatCard title="Valor aplicado" value={aplicado} icon={PieChart} />
        <StatCard
          title="Resultado"
          value={resultado}
          subtitle={aplicado > 0 ? `${formatPct(rentabilidade)} sobre o aplicado` : undefined}
          icon={PieChart}
          trend={resultado >= 0 ? "up" : "down"}
        />
        <StatCard
          title="Variação no pregão"
          value={variacaoDia}
          subtitle={atual > 0 && variacaoDia ? `${formatPct((variacaoDia / (atual - variacaoDia)) * 100)} no dia` : undefined}
          icon={PieChart}
          trend={variacaoDia >= 0 ? "up" : "down"}
        />
      </section>

      {positions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-sm text-[var(--color-muted)]">
          Nenhum investimento cadastrado ainda.
        </p>
      ) : (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <h2 className="px-5 pt-5 text-lg font-semibold">Investimentos</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                    <th className="px-5 py-3 font-medium">Ativo</th>
                    <th className="px-5 py-3 font-medium">Classe</th>
                    <th className="px-5 py-3 text-right font-medium">Qtd.</th>
                    <th className="px-5 py-3 text-right font-medium">Cotação</th>
                    <th className="px-5 py-3 text-right font-medium">Dia</th>
                    <th className="px-5 py-3 text-right font-medium">Aplicado</th>
                    <th className="px-5 py-3 text-right font-medium">Atual</th>
                    <th className="px-5 py-3 text-right font-medium">Resultado</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {positions.map((item) => {
                    const gain = item.atual - item.aplicado;
                    const gainPct = item.aplicado > 0 ? (gain / item.aplicado) * 100 : 0;
                    return (
                      <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="px-5 py-3 font-medium">{item.nome}</td>
                        <td className="px-5 py-3">{item.classe}</td>
                        <td className="px-5 py-3 text-right">{item.quantidade ? formatQty(item.quantidade) : "—"}</td>
                        <td className="px-5 py-3 text-right">{item.preco ? formatBRL(item.preco) : "—"}</td>
                        <td
                          className={`px-5 py-3 text-right ${
                            (item.variacaoDia ?? 0) >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                          }`}
                        >
                          {item.variacaoDia !== undefined ? formatPct(item.variacaoDia) : "—"}
                        </td>
                        <td className="px-5 py-3 text-right">{formatBRL(item.aplicado)}</td>
                        <td className="px-5 py-3 text-right">{formatBRL(item.atual)}</td>
                        <td
                          className={`px-5 py-3 text-right font-medium ${gain >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}
                        >
                          {gain >= 0 ? "+" : ""}
                          {formatBRL(gain)}
                          {item.aplicado > 0 ? (
                            <span className="block text-xs font-normal">{formatPct(gainPct)}</span>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-3">
                            <button type="button" onClick={() => startEdit(item)} aria-label={`Editar ${item.nome}`}>
                              <Pencil className="h-4 w-4 text-[var(--color-muted)]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => persist(positions.filter((position) => position.id !== item.id))}
                              aria-label={`Remover ${item.nome}`}
                            >
                              <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

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
        </div>
      )}
    </div>
  );
}
