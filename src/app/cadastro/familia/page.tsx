"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Plus, Trash2, Users } from "lucide-react";
import { Field, SelectInput, TextInput } from "@/components/form-field";
import {
  loadFamily,
  loadPeople,
  saveFamily,
  type FamilyGroup,
  type FamilyPayment,
  type Person,
} from "@/lib/people";
import { parseMoney } from "@/lib/records";
import { formatBRL } from "@/lib/utils";

const PARENTESCOS = ["Titular", "Cônjuge", "Filho(a)", "Pai", "Mãe", "Irmão(ã)", "Outro"];

export default function InclusaoFamiliaPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [group, setGroup] = useState<FamilyGroup>({ nomeFamilia: "", divisao: "igual", membros: [] });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { descricao: string; valor: string }>>({});
  const [paymentError, setPaymentError] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadedPeople = loadPeople();
    const loadedFamily = loadFamily();
    const ids = new Set(loadedPeople.map((person) => person.id));
    setPeople(loadedPeople);
    setGroup({
      ...loadedFamily,
      membros: loadedFamily.membros.filter((member) => ids.has(member.personId)),
    });
    if (loadedFamily.nomeFamilia) setSaved(true);
  }, []);

  function included(personId: string) {
    return group.membros.some((member) => member.personId === personId);
  }

  function parentescoOf(personId: string) {
    return group.membros.find((member) => member.personId === personId)?.parentesco ?? "Cônjuge";
  }

  function toggle(person: Person) {
    setSaved(false);
    setGroup((current) => {
      if (current.membros.some((member) => member.personId === person.id)) {
        return { ...current, membros: current.membros.filter((member) => member.personId !== person.id) };
      }
      return {
        ...current,
        membros: [
          ...current.membros,
          { personId: person.id, parentesco: person.papel === "titular" ? "Titular" : "Cônjuge" },
        ],
      };
    });
  }

  function setParentesco(personId: string, parentesco: string) {
    setSaved(false);
    setGroup((current) => ({
      ...current,
      membros: current.membros.map((member) =>
        member.personId === personId ? { ...member, parentesco } : member,
      ),
    }));
  }

  function paymentsOf(personId: string): FamilyPayment[] {
    return group.membros.find((member) => member.personId === personId)?.pagamentos ?? [];
  }

  function updatePayments(personId: string, pagamentos: FamilyPayment[]) {
    setSaved(false);
    setGroup((current) => ({
      ...current,
      membros: current.membros.map((member) =>
        member.personId === personId ? { ...member, pagamentos } : member,
      ),
    }));
  }

  function addPayment(personId: string) {
    const draft = drafts[personId] ?? { descricao: "", valor: "" };
    const valor = parseMoney(draft.valor);
    if (!draft.descricao.trim() || !Number.isFinite(valor) || valor <= 0) {
      setPaymentError((current) => ({ ...current, [personId]: "Informe o que paga e um valor maior que zero." }));
      return;
    }
    setPaymentError((current) => ({ ...current, [personId]: "" }));
    updatePayments(personId, [
      ...paymentsOf(personId),
      { id: crypto.randomUUID(), descricao: draft.descricao.trim(), valor },
    ]);
    setDrafts((current) => ({ ...current, [personId]: { descricao: "", valor: "" } }));
  }

  const totalCustom = group.membros.reduce(
    (sum, member) => sum + (member.pagamentos ?? []).reduce((acc, item) => acc + item.valor, 0),
    0,
  );

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!group.nomeFamilia.trim()) {
      setError("Informe o nome da família.");
      return;
    }
    if (group.membros.length === 0) {
      setError("Inclua pelo menos uma pessoa na família.");
      return;
    }
    setError("");
    saveFamily({ ...group, nomeFamilia: group.nomeFamilia.trim() });
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <Users className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Inclusão da família</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Quem você marcar aqui forma a família. O calendário separa o que é de cada e-mail e também mostra todos juntos.
          </p>
        </div>
      </header>

      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          Família salva neste navegador.
        </p>
      ) : null}

      {people.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <p className="text-sm text-[var(--color-muted)]">
            Ainda não há pessoas cadastradas. Cadastre o titular e os familiares antes de montar a família.
          </p>
          <Link
            href="/cadastro/pessoas"
            className="mt-4 inline-flex rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Cadastrar pessoas
          </Link>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da família">
              <TextInput
                value={group.nomeFamilia}
                onChange={(e) => {
                  setSaved(false);
                  setGroup((current) => ({ ...current, nomeFamilia: e.target.value }));
                }}
                required
              />
            </Field>
            <Field label="Divisão dos gastos da casa">
              <SelectInput
                value={group.divisao}
                onChange={(e) => {
                  setSaved(false);
                  setGroup((current) => ({
                    ...current,
                    divisao: e.target.value as FamilyGroup["divisao"],
                  }));
                }}
              >
                <option value="igual">Igual entre os adultos</option>
                <option value="proporcional">Proporcional à renda</option>
                <option value="titular">Titular paga as despesas da casa</option>
                <option value="personalizado">Personalizado: cada um informa o que paga</option>
              </SelectInput>
            </Field>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Pessoas para incluir</legend>
            {people.map((person) => {
              const checked = included(person.id);
              return (
                <div
                  key={person.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4"
                >
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(person)}
                      className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
                    />
                    <span>
                      <span className="block font-medium">{person.nome}</span>
                      <span className="block text-xs text-[var(--color-muted)]">
                        {person.papel === "familiar" ? "Familiar" : "Titular"}
                        {person.email ? ` · ${person.email}` : ""}
                      </span>
                    </span>
                  </label>
                  {checked ? (
                    <div className="mt-3 max-w-xs pl-7">
                      <Field label="Parentesco na família">
                        <SelectInput
                          value={parentescoOf(person.id)}
                          onChange={(e) => setParentesco(person.id, e.target.value)}
                        >
                          {PARENTESCOS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                    </div>
                  ) : null}
                  {checked && group.divisao === "personalizado" ? (
                    <div className="mt-4 space-y-3 pl-7">
                      <p className="text-sm font-semibold">O que {person.nome.split(" ")[0]} paga</p>
                      {paymentsOf(person.id).length > 0 ? (
                        <ul className="space-y-2">
                          {paymentsOf(person.id).map((item) => (
                            <li
                              key={item.id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
                            >
                              <span>{item.descricao}</span>
                              <span className="flex items-center gap-3">
                                <span className="font-semibold">{formatBRL(item.valor)}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updatePayments(
                                      person.id,
                                      paymentsOf(person.id).filter((payment) => payment.id !== item.id),
                                    )
                                  }
                                  aria-label={`Remover ${item.descricao}`}
                                >
                                  <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
                        <Field label="Despesa">
                          <TextInput
                            value={drafts[person.id]?.descricao ?? ""}
                            onChange={(e) =>
                              setDrafts((current) => ({
                                ...current,
                                [person.id]: { descricao: e.target.value, valor: current[person.id]?.valor ?? "" },
                              }))
                            }
                          />
                        </Field>
                        <Field label="Valor mensal">
                          <TextInput
                            inputMode="decimal"
                            value={drafts[person.id]?.valor ?? ""}
                            onChange={(e) =>
                              setDrafts((current) => ({
                                ...current,
                                [person.id]: { descricao: current[person.id]?.descricao ?? "", valor: e.target.value },
                              }))
                            }
                          />
                        </Field>
                        <button
                          type="button"
                          onClick={() => addPayment(person.id)}
                          className="inline-flex items-center justify-center gap-1 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium hover:border-[var(--color-accent)]"
                        >
                          <Plus className="h-4 w-4" aria-hidden />
                          Adicionar
                        </button>
                      </div>
                      {paymentError[person.id] ? (
                        <p className="text-sm text-[var(--color-danger)]">{paymentError[person.id]}</p>
                      ) : null}
                      <p className="text-sm text-[var(--color-muted)]">
                        Total de {person.nome.split(" ")[0]}:{" "}
                        <span className="font-semibold text-[var(--color-foreground)]">
                          {formatBRL(paymentsOf(person.id).reduce((acc, item) => acc + item.valor, 0))}
                        </span>
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </fieldset>

          {group.divisao === "personalizado" && group.membros.length > 0 ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
              <p className="text-sm font-semibold">Resumo da divisão</p>
              <ul className="mt-3 space-y-2 text-sm">
                {group.membros.map((member) => {
                  const person = people.find((item) => item.id === member.personId);
                  const total = (member.pagamentos ?? []).reduce((acc, item) => acc + item.valor, 0);
                  const share = totalCustom > 0 ? Math.round((total / totalCustom) * 100) : 0;
                  return (
                    <li key={member.personId} className="flex justify-between gap-3">
                      <span>{person?.nome ?? "Pessoa"}</span>
                      <span>
                        {formatBRL(total)} <span className="text-[var(--color-muted)]">({share}%)</span>
                      </span>
                    </li>
                  );
                })}
                <li className="flex justify-between gap-3 border-t border-[var(--color-border)] pt-2 font-semibold">
                  <span>Total da casa</span>
                  <span>{formatBRL(totalCustom)}</span>
                </li>
              </ul>
            </div>
          ) : null}

          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/cadastro/pessoas" className="text-sm text-[var(--color-accent)] hover:underline">
              Cadastrar outra pessoa
            </Link>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Salvar família
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
