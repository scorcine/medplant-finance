"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Users } from "lucide-react";
import { Field, SelectInput, TextInput } from "@/components/form-field";
import { loadFamily, loadPeople, saveFamily, type FamilyGroup, type Person } from "@/lib/people";

const PARENTESCOS = ["Titular", "Cônjuge", "Filho(a)", "Pai", "Mãe", "Irmão(ã)", "Outro"];

export default function InclusaoFamiliaPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [group, setGroup] = useState<FamilyGroup>({ nomeFamilia: "", divisao: "igual", membros: [] });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

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
          { personId: person.id, parentesco: person.papel === "medico" ? "Titular" : "Cônjuge" },
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
            Escolha, entre as pessoas já cadastradas, quem faz parte da família.
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
            Ainda não há pessoas cadastradas. Cadastre o médico e os familiares antes de montar a família.
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
                placeholder="Família Silva"
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
                        {person.papel === "medico" ? "Médico" : "Familiar"}
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
                </div>
              );
            })}
          </fieldset>

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
