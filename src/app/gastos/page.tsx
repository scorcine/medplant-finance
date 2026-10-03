"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, Square, Trash2 } from "lucide-react";
import { Field, SelectInput, TextInput } from "@/components/form-field";
import { ScopeToggle } from "@/components/scope-toggle";
import {
  KIND_LABEL,
  expensesInMonth,
  inScope,
  type CreditCard,
  type Expense,
  type ExpenseEntry,
  type ExpenseKind,
  type ViewScope,
  SPLIT_PAYER,
  payerShares,
} from "@/lib/types";
import {
  currentMonthKey,
  DATA_EVENT,
  loadCards,
  loadExpenses,
  parseMoney,
  saveExpenses,
  todayKey,
} from "@/lib/records";
import { loadFamily, loadOwner, loadPeople, type FamilyGroup, type Person } from "@/lib/people";
import { cn, formatBRL } from "@/lib/utils";

const KINDS: ExpenseKind[] = ["fixo", "cartao", "variavel"];

const BASE_CATEGORIES = [
  "Moradia",
  "Educação",
  "Saúde",
  "Alimentação",
  "Mercado",
  "Transporte",
  "Contas da casa",
  "Funcionários",
  "Esporte",
  "Lazer",
  "Assinaturas",
  "Família",
  "Outros",
];

const KIND_HINT: Record<ExpenseKind, string> = {
  fixo: "Entra todo mês sozinho, a partir da data de início, até você encerrar.",
  cartao: "Compra no cartão. Parcelado entra uma parcela em cada mês.",
  variavel: "Gasto do dia a dia, só no mês da data.",
};

const blank = {
  tipo: "variavel" as ExpenseKind,
  date: "",
  description: "",
  amount: "",
  category: "",
  scope: "pessoal" as Expense["scope"],
  payment: "debito" as Expense["payment"],
  paidBy: "",
  cardId: "",
  parcelas: "1",
  split: {} as Record<string, string>,
};

const DIVISAO_LABEL: Record<FamilyGroup["divisao"], string> = {
  igual: "Igual entre os adultos",
  proporcional: "Proporcional à renda",
  titular: "Titular paga as despesas da casa",
  personalizado: "Personalizado: cada um informa o que paga",
};

function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number);
  const label = new Date(year, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function firstName(name: string) {
  return name.split(" ")[0];
}

export default function GastosPage() {
  const [scope, setScope] = useState<ViewScope>("consolidado");
  const [list, setList] = useState<Expense[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [family, setFamily] = useState<FamilyGroup>({ nomeFamilia: "", divisao: "igual", membros: [] });
  const [month, setMonth] = useState("");
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ id: string; month: string } | null>(null);
  const [applyFrom, setApplyFrom] = useState<"todos" | "mes">("todos");
  const [notice, setNotice] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPayer, setFilterPayer] = useState("");

  useEffect(() => {
    function refresh() {
      setPeople(loadPeople());
      setFamily(loadFamily());
      setCards(loadCards());
    }
    refresh();
    setList(loadExpenses());
    setMonth(currentMonthKey());
    setForm((current) => ({ ...current, date: todayKey(), paidBy: loadOwner()?.id ?? "" }));
    window.addEventListener(DATA_EVENT, refresh);
    return () => window.removeEventListener(DATA_EVENT, refresh);
  }, []);

  const payers = useMemo(() => {
    const familyIds = family.membros.map((member) => member.personId);
    const inFamily = people.filter((person) => familyIds.includes(person.id));
    return inFamily.length > 0 ? inFamily : people;
  }, [people, family]);

  useEffect(() => {
    if (form.paidBy === SPLIT_PAYER) return;
    if (payers.length > 0 && !payers.some((person) => person.id === form.paidBy)) {
      setForm((current) => ({ ...current, paidBy: payers[0].id }));
    }
  }, [payers, form.paidBy]);

  function equalSplit() {
    const each = payers.length > 0 ? 100 / payers.length : 0;
    return Object.fromEntries(payers.map((person) => [person.id, String(Math.round(each * 100) / 100).replace(".", ",")]));
  }

  const memberIds = payers.map((person) => person.id);
  const sharesOf = (expense: Expense) => payerShares(expense, memberIds);

  function payerLabel(expense: Expense) {
    if (expense.paidBy !== SPLIT_PAYER) return personName(expense.paidBy);
    const shares = Object.entries(sharesOf(expense));
    if (shares.length === 0) return "Dividido";
    return `Dividido: ${shares.map(([id, share]) => `${firstName(personName(id))} ${Math.round(share * 100)}%`).join(" · ")}`;
  }

  useEffect(() => {
    if (form.tipo === "cartao" && cards.length > 0 && !cards.some((card) => card.id === form.cardId)) {
      setForm((current) => ({ ...current, cardId: cards[0].id }));
    }
  }, [cards, form.tipo, form.cardId]);

  function personName(id?: string) {
    if (!id) return "Não informado";
    return people.find((person) => person.id === id)?.nome ?? "Não informado";
  }

  function cardName(id?: string) {
    return cards.find((card) => card.id === id)?.name ?? "";
  }

  const categories = Array.from(
    new Set([...BASE_CATEGORIES, ...list.map((expense) => expense.category).filter((item) => item !== "Sem categoria")]),
  );

  const entries = month ? expensesInMonth(list, month) : [];
  const scoped = entries.filter((entry) => inScope(entry.expense, scope));
  function knownShares(expense: Expense) {
    const shares = Object.entries(sharesOf(expense)).filter(([id]) => people.some((person) => person.id === id));
    return shares.length > 0 ? shares : [["nenhum", 1] as [string, number]];
  }

  function onlyPayer(items: ExpenseEntry[]) {
    if (!filterPayer) return items;
    return items.flatMap((entry) => {
      const share = knownShares(entry.expense).find(([id]) => id === filterPayer)?.[1] ?? 0;
      return share > 0 ? [{ ...entry, amount: entry.amount * share, share }] : [];
    });
  }

  const matchCategory = (entry: ExpenseEntry) => !filterCategory || entry.expense.category === filterCategory;
  const visible: Array<ExpenseEntry & { share?: number }> = onlyPayer(scoped.filter(matchCategory));
  const filtering = Boolean(filterCategory || filterPayer);

  function groupTotals(items: ExpenseEntry[], keyOf: (entry: ExpenseEntry) => string) {
    const totals = new Map<string, number>();
    for (const entry of items) totals.set(keyOf(entry), (totals.get(keyOf(entry)) ?? 0) + entry.amount);
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  }

  function payerTotals(items: ExpenseEntry[]) {
    const totals = new Map<string, number>();
    for (const entry of items) {
      for (const [id, share] of knownShares(entry.expense)) {
        totals.set(id, (totals.get(id) ?? 0) + entry.amount * share);
      }
    }
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  }

  const byCategory = groupTotals(onlyPayer(scoped), (entry) => entry.expense.category);
  const byPayer = payerTotals(scoped.filter(matchCategory));
  const monthCategories = Array.from(new Set(scoped.map((entry) => entry.expense.category))).sort();
  const totalOf = (kind: ExpenseKind) =>
    visible.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + entry.amount, 0);
  const total = visible.reduce((sum, entry) => sum + entry.amount, 0);

  const familyEntries = entries.filter((entry) => entry.expense.scope === "familia");
  const familyTotal = familyEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const familyMembers = people.filter((person) => family.membros.some((member) => member.personId === person.id));
  const equalShare = familyMembers.length > 0 ? familyTotal / familyMembers.length : 0;
  const familyPaid = new Map<string, number>();
  let unassigned = 0;
  for (const entry of familyEntries) {
    let assigned = 0;
    for (const [id, share] of Object.entries(sharesOf(entry.expense))) {
      if (!familyMembers.some((person) => person.id === id)) continue;
      familyPaid.set(id, (familyPaid.get(id) ?? 0) + entry.amount * share);
      assigned += share;
    }
    unassigned += entry.amount * Math.max(0, 1 - assigned);
  }

  function persist(next: Expense[]) {
    setList(next);
    saveExpenses(next);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const amount = parseMoney(form.amount);
    if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Informe a descrição e um valor maior que zero.");
      return;
    }
    const parcelas = form.tipo === "cartao" ? Math.max(1, Math.min(48, Math.round(Number(form.parcelas) || 1))) : undefined;
    const original = editing ? list.find((expense) => expense.id === editing.id) : undefined;
    const expense: Expense = {
      ...(original ?? {}),
      id: original?.id ?? crypto.randomUUID(),
      date: form.date,
      description: form.description.trim(),
      amount,
      category: form.category.trim() || "Sem categoria",
      scope: form.scope,
      payment: form.tipo === "cartao" ? "credito" : form.payment,
      paidBy: form.paidBy || undefined,
      tipo: form.tipo,
      cardId: form.tipo === "cartao" ? form.cardId || undefined : undefined,
      parcelas,
      fimMes: form.tipo === "fixo" ? original?.fimMes : undefined,
      split: undefined,
    };
    if (form.paidBy === SPLIT_PAYER) {
      const split = Object.fromEntries(
        payers
          .map((person) => [person.id, parseMoney(form.split[person.id] ?? "")] as const)
          .filter(([, value]) => Number.isFinite(value) && value > 0),
      );
      if (Object.keys(split).length === 0) {
        setError("Informe a porcentagem de cada pessoa na divisão.");
        return;
      }
      expense.split = split;
    }
    setError("");

    if (original && editing) {
      const start = original.date.slice(0, 7);
      if (original.tipo === "fixo" && form.tipo === "fixo" && applyFrom === "mes" && editing.month > start) {
        const continuation: Expense = {
          ...expense,
          id: crypto.randomUUID(),
          date: `${editing.month}-${form.date.slice(8, 10)}`,
        };
        persist([
          continuation,
          ...list.map((item) => (item.id === original.id ? { ...item, fimMes: shiftMonth(editing.month, -1) } : item)),
        ]);
        setNotice(`"${expense.description}" alterado a partir de ${monthLabel(editing.month)}.`);
      } else {
        persist(list.map((item) => (item.id === original.id ? expense : item)));
        setNotice(`"${expense.description}" alterado.`);
        if (expense.tipo !== "fixo" && expense.date.slice(0, 7) !== month) setMonth(expense.date.slice(0, 7));
      }
      cancelEdit();
      return;
    }

    persist([expense, ...list]);
    setNotice("");
    if (form.date.slice(0, 7) !== month) setMonth(form.date.slice(0, 7));
    setForm({ ...form, description: "", amount: "", parcelas: "1" });
  }

  function startEdit(entry: ExpenseEntry) {
    const expense = entry.expense;
    setEditing({ id: expense.id, month });
    setApplyFrom("todos");
    setNotice("");
    setError("");
    setForm({
      tipo: entry.kind,
      date: expense.date,
      description: expense.description,
      amount: expense.amount.toFixed(2).replace(".", ","),
      category: expense.category === "Sem categoria" ? "" : expense.category,
      scope: expense.scope,
      payment: expense.payment,
      paidBy: expense.paidBy ?? "",
      cardId: expense.cardId ?? "",
      parcelas: String(expense.parcelas ?? 1),
      split:
        expense.paidBy === SPLIT_PAYER
          ? Object.fromEntries(
              Object.entries(sharesOf(expense)).map(([id, share]) => [
                id,
                String(Math.round(share * 10000) / 100).replace(".", ","),
              ]),
            )
          : {},
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    setApplyFrom("todos");
    setForm((current) => ({ ...blank, tipo: current.tipo, date: todayKey(), paidBy: current.paidBy, scope: current.scope }));
  }

  function remove(id: string) {
    persist(list.filter((expense) => expense.id !== id));
  }

  function endFixed(entry: ExpenseEntry) {
    const start = entry.expense.date.slice(0, 7);
    if (month <= start) {
      remove(entry.expense.id);
      return;
    }
    persist(list.map((expense) => (expense.id === entry.expense.id ? { ...expense, fimMes: shiftMonth(month, -1) } : expense)));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Gastos</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Fixos, cartão de crédito e variáveis, mês a mês, com quem pagou cada um.
          </p>
        </div>
        <ScopeToggle value={scope} onChange={setScope} />
      </header>

      <form
        onSubmit={onSubmit}
        className={cn(
          "space-y-4 rounded-2xl border bg-[var(--color-surface)] p-5",
          editing ? "border-[var(--color-accent)]" : "border-[var(--color-border)]",
        )}
      >
        {editing ? <p className="text-sm font-semibold text-[var(--color-accent)]">Editando gasto</p> : null}
        <div>
          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-1">
            {KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setForm({ ...form, tipo: kind })}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium",
                  form.tipo === kind ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)]",
                )}
              >
                {KIND_LABEL[kind]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">{KIND_HINT[form.tipo]}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label={form.tipo === "fixo" ? "Início (dia do vencimento)" : form.tipo === "cartao" ? "Data da compra" : "Data"}>
            <TextInput type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
          </Field>
          <Field label="Descrição" className="md:col-span-2">
            <TextInput
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              required
            />
          </Field>
          <Field label={form.tipo === "fixo" ? "Valor mensal" : form.tipo === "cartao" ? "Valor total da compra" : "Valor"}>
            <TextInput
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              required
            />
          </Field>
          {form.tipo === "cartao" ? (
            <>
              <Field label="Cartão">
                {cards.length === 0 ? (
                  <p className="py-2.5 text-sm text-[var(--color-muted)]">
                    <Link href="/cartoes" className="text-[var(--color-accent)] hover:underline">
                      Cadastrar cartão
                    </Link>
                  </p>
                ) : (
                  <SelectInput value={form.cardId} onChange={(event) => setForm({ ...form, cardId: event.target.value })}>
                    {cards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                        {card.last4 ? ` •••• ${card.last4}` : ""}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>
              <Field label="Parcelas">
                <SelectInput value={form.parcelas} onChange={(event) => setForm({ ...form, parcelas: event.target.value })}>
                  {Array.from({ length: 24 }, (_, index) => index + 1).map((count) => (
                    <option key={count} value={count}>
                      {count === 1 ? "À vista" : `${count}x`}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </>
          ) : (
            <Field label="Pagamento">
              <SelectInput
                value={form.payment}
                onChange={(event) => setForm({ ...form, payment: event.target.value as Expense["payment"] })}
              >
                <option value="debito">Débito</option>
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="credito">Crédito</option>
              </SelectInput>
            </Field>
          )}
          <Field label="Categoria">
            <TextInput
              list="categorias-gasto"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            />
            <datalist id="categorias-gasto">
              {categories.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </Field>
          <Field label="Escopo">
            <SelectInput
              value={form.scope}
              onChange={(event) => setForm({ ...form, scope: event.target.value as Expense["scope"] })}
            >
              <option value="pessoal">Pessoal</option>
              <option value="familia">Família</option>
            </SelectInput>
          </Field>
          <Field label="Quem pagou">
            <SelectInput
              value={form.paidBy}
              onChange={(event) => {
                const paidBy = event.target.value;
                setForm({
                  ...form,
                  paidBy,
                  split: paidBy === SPLIT_PAYER && Object.keys(form.split).length === 0 ? equalSplit() : form.split,
                });
              }}
            >
              {payers.length === 0 ? <option value="">Não informado</option> : null}
              {payers.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.nome}
                </option>
              ))}
              {payers.length > 1 ? <option value={SPLIT_PAYER}>Dividido</option> : null}
            </SelectInput>
          </Field>
        </div>
        {form.paidBy === SPLIT_PAYER ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Divisão do valor</p>
              <button
                type="button"
                onClick={() => setForm({ ...form, split: equalSplit() })}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Dividir igualmente
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {payers.map((person) => {
                const percent = parseMoney(form.split[person.id] ?? "");
                const amount = parseMoney(form.amount);
                return (
                  <Field key={person.id} label={`${person.nome} (%)`}>
                    <TextInput
                      inputMode="decimal"
                      value={form.split[person.id] ?? ""}
                      onChange={(event) =>
                        setForm({ ...form, split: { ...form.split, [person.id]: event.target.value } })
                      }
                    />
                    {Number.isFinite(percent) && Number.isFinite(amount) ? (
                      <span className="mt-1 block text-xs text-[var(--color-muted)]">
                        {formatBRL((amount * percent) / 100)}
                      </span>
                    ) : null}
                  </Field>
                );
              })}
            </div>
            {(() => {
              const sum = payers.reduce((acc, person) => {
                const value = parseMoney(form.split[person.id] ?? "");
                return acc + (Number.isFinite(value) ? value : 0);
              }, 0);
              return Math.abs(sum - 100) > 0.01 ? (
                <p className="mt-2 text-xs text-[var(--color-warning)]">
                  A soma está em {sum.toFixed(2).replace(".", ",")}%. O valor será dividido proporcionalmente.
                </p>
              ) : null;
            })()}
          </div>
        ) : null}
        {form.tipo === "cartao" && Number(form.parcelas) > 1 && parseMoney(form.amount) > 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            {form.parcelas}x de {formatBRL(parseMoney(form.amount) / Number(form.parcelas))}
          </p>
        ) : null}
        {editing &&
        form.tipo === "fixo" &&
        list.find((expense) => expense.id === editing.id)?.tipo === "fixo" &&
        editing.month > (list.find((expense) => expense.id === editing.id)?.date.slice(0, 7) ?? "") ? (
          <Field label="Aplicar a alteração" className="max-w-sm">
            <SelectInput value={applyFrom} onChange={(event) => setApplyFrom(event.target.value as "todos" | "mes")}>
              <option value="todos">Em todos os meses</option>
              <option value="mes">A partir de {monthLabel(editing.month)} (mantém os meses anteriores)</option>
            </SelectInput>
          </Field>
        ) : null}
        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white">
            {editing
              ? "Salvar alteração"
              : form.tipo === "fixo"
                ? "Lançar gasto fixo"
                : form.tipo === "cartao"
                  ? "Lançar compra no cartão"
                  : "Lançar gasto"}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      {notice ? <p className="text-sm text-[var(--color-success)]">{notice}</p> : null}

      <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
        <button
          type="button"
          onClick={() => setMonth((current) => shiftMonth(current, -1))}
          aria-label="Mês anterior"
          className="rounded-lg p-2 hover:bg-[var(--color-background)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-semibold">{month ? monthLabel(month) : ""}</p>
        <button
          type="button"
          onClick={() => setMonth((current) => shiftMonth(current, 1))}
          aria-label="Próximo mês"
          className="rounded-lg p-2 hover:bg-[var(--color-background)]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:flex-row sm:items-end">
        <Field label="Filtrar por categoria" className="sm:w-60">
          <SelectInput value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}>
            <option value="">Todas as categorias</option>
            {monthCategories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Filtrar por quem pagou" className="sm:w-60">
          <SelectInput value={filterPayer} onChange={(event) => setFilterPayer(event.target.value)}>
            <option value="">Todos</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.nome}
              </option>
            ))}
            <option value="nenhum">Não informado</option>
          </SelectInput>
        </Field>
        {filtering ? (
          <button
            type="button"
            onClick={() => {
              setFilterCategory("");
              setFilterPayer("");
            }}
            className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-muted)]"
          >
            Limpar filtros
          </button>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {[
          { title: "Por categoria", rows: byCategory, active: filterCategory, select: setFilterCategory, label: (key: string) => key },
          {
            title: "Por quem pagou",
            rows: byPayer,
            active: filterPayer,
            select: setFilterPayer,
            label: (key: string) => (key === "nenhum" ? "Não informado" : personName(key)),
          },
        ].map((group) => {
          const groupTotal = group.rows.reduce((sum, [, value]) => sum + value, 0);
          return (
            <div key={group.title} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="font-semibold">{group.title}</h2>
              {group.rows.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--color-muted)]">Nada neste mês.</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {group.rows.map(([key, value]) => {
                    const share = groupTotal > 0 ? (value / groupTotal) * 100 : 0;
                    const active = group.active === key;
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => group.select(active ? "" : key)}
                          className={cn(
                            "w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--color-surface-elevated)]",
                            active && "bg-[var(--color-accent-soft)]",
                          )}
                        >
                          <span className="flex justify-between gap-3">
                            <span>{group.label(key)}</span>
                            <span className="font-medium">
                              {formatBRL(value)}{" "}
                              <span className="text-xs text-[var(--color-muted)]">{share.toFixed(0)}%</span>
                            </span>
                          </span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--color-background)]">
                            <span
                              className="block h-full rounded-full bg-[var(--color-accent)]"
                              style={{ width: `${share}%` }}
                            />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KINDS.map((kind) => (
          <div key={kind} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
            <p className="text-sm text-[var(--color-muted)]">{kind === "fixo" ? "Fixos" : kind === "cartao" ? "Cartão de crédito" : "Variáveis"}</p>
            <p className="text-xl font-semibold">{formatBRL(totalOf(kind))}</p>
          </div>
        ))}
        <div className="rounded-2xl border border-[var(--color-accent)]/40 bg-[var(--color-surface)] px-5 py-4">
          <p className="text-sm text-[var(--color-muted)]">{filtering ? "Total com filtro" : "Total do mês"}</p>
          <p className="text-xl font-semibold">{formatBRL(total)}</p>
        </div>
      </section>

      {KINDS.map((kind) => {
        const items = visible.filter((entry) => entry.kind === kind);
        return (
          <section key={kind} className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="flex items-baseline justify-between px-5 pt-5">
              <h2 className="text-lg font-semibold">
                {kind === "fixo" ? "Gastos fixos" : kind === "cartao" ? "Cartão de crédito" : "Gastos variáveis"}
              </h2>
              <p className="text-sm font-semibold">{formatBRL(totalOf(kind))}</p>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                    <th className="px-5 py-3 font-medium">{kind === "fixo" ? "Vence" : "Data"}</th>
                    <th className="px-5 py-3 font-medium">Descrição</th>
                    <th className="px-5 py-3 font-medium">Categoria</th>
                    <th className="px-5 py-3 font-medium">Escopo</th>
                    <th className="px-5 py-3 font-medium">Quem pagou</th>
                    <th className="px-5 py-3 text-right font-medium">Valor</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-5 text-[var(--color-muted)]">
                        Nada neste mês.
                      </td>
                    </tr>
                  ) : null}
                  {items.map((entry) => (
                    <tr key={entry.expense.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-5 py-3 text-[var(--color-muted)]">
                        {new Date(entry.date + "T12:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-medium">{entry.expense.description}</span>
                        {entry.parcela ? (
                          <span className="ml-2 text-xs text-[var(--color-muted)]">parcela {entry.parcela}</span>
                        ) : null}
                        {kind === "cartao" && cardName(entry.expense.cardId) ? (
                          <span className="block text-xs text-[var(--color-muted)]">{cardName(entry.expense.cardId)}</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">{entry.expense.category}</td>
                      <td className="px-5 py-3">{entry.expense.scope === "familia" ? "Família" : "Pessoal"}</td>
                      <td className="px-5 py-3">{payerLabel(entry.expense)}</td>
                      <td className="px-5 py-3 text-right font-semibold">
                        {formatBRL(entry.amount)}
                        {"share" in entry && entry.share !== undefined && entry.share < 1 ? (
                          <span className="block text-xs font-normal text-[var(--color-muted)]">
                            parte de {Math.round(entry.share * 100)}%
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(entry)}
                            aria-label={`Editar ${entry.expense.description}`}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4 text-[var(--color-muted)]" />
                          </button>
                          {kind === "fixo" ? (
                            <button
                              type="button"
                              onClick={() => endFixed(entry)}
                              aria-label={`Encerrar ${entry.expense.description}`}
                              title="Encerrar a partir deste mês"
                            >
                              <Square className="h-4 w-4 text-[var(--color-warning)]" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => remove(entry.expense.id)}
                            aria-label={`Excluir ${entry.expense.description}`}
                            title={kind === "fixo" || entry.parcela ? "Excluir de todos os meses" : "Excluir"}
                          >
                            <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold">Custos da família no mês</p>
          {familyMembers.length > 0 ? (
            <p className="text-xs text-[var(--color-muted)]">{DIVISAO_LABEL[family.divisao]}</p>
          ) : null}
        </div>
        {familyMembers.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Monte a família em{" "}
            <Link href="/cadastro/familia" className="text-[var(--color-accent)] hover:underline">
              Inclusão da família
            </Link>{" "}
            para ver quanto cada um pagou.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {familyMembers.map((person) => {
              const paid = familyPaid.get(person.id) ?? 0;
              const share = familyTotal > 0 ? Math.round((paid / familyTotal) * 100) : 0;
              const balance = paid - equalShare;
              return (
                <li key={person.id} className="flex flex-wrap justify-between gap-2">
                  <span>{person.nome}</span>
                  <span className="text-right">
                    {formatBRL(paid)} <span className="text-[var(--color-muted)]">({share}%)</span>
                    {family.divisao === "igual" && familyTotal > 0 && Math.abs(balance) >= 0.01 ? (
                      <span
                        className={
                          balance > 0
                            ? "ml-2 text-xs text-[var(--color-success)]"
                            : "ml-2 text-xs text-[var(--color-danger)]"
                        }
                      >
                        {balance > 0
                          ? `${firstName(person.nome)} recebe ${formatBRL(balance)}`
                          : `${firstName(person.nome)} deve ${formatBRL(-balance)}`}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
            {unassigned > 0 ? (
              <li className="flex justify-between gap-2 text-[var(--color-muted)]">
                <span>Sem pagador informado</span>
                <span>{formatBRL(unassigned)}</span>
              </li>
            ) : null}
            <li className="flex justify-between gap-2 border-t border-[var(--color-border)] pt-2 font-semibold">
              <span>Total da casa</span>
              <span>{formatBRL(familyTotal)}</span>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
