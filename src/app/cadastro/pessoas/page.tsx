"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, UserRound } from "lucide-react";
import { Field, SelectInput, TextInput } from "@/components/form-field";
import { loadPeople, savePeople, type Person, type PersonRole } from "@/lib/people";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const ESPECIALIDADES = [
  "Clínica médica",
  "Pediatria",
  "Cirurgia geral",
  "Ginecologia e obstetrícia",
  "Ortopedia",
  "Cardiologia",
  "Anestesiologia",
  "Medicina de emergência",
  "Outra",
];

const blank = (): Omit<Person, "id"> => ({
  nome: "",
  email: "",
  telefone: "",
  papel: "medico",
  crm: "",
  uf: "SP",
  especialidade: "Clínica médica",
});

export default function CadastroPessoasPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");

  useEffect(() => {
    setPeople(loadPeople());
  }, []);

  function update<K extends keyof Omit<Person, "id">>(key: K, value: Omit<Person, "id">[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.nome.trim()) {
      setError("Informe o nome da pessoa.");
      return;
    }
    if (form.papel === "medico" && !form.crm.trim()) {
      setError("Informe o CRM do médico.");
      return;
    }
    setError("");
    const next = [...people, { ...form, id: crypto.randomUUID(), nome: form.nome.trim() }];
    setPeople(next);
    savePeople(next);
    setForm(blank());
  }

  function remove(id: string) {
    const next = people.filter((person) => person.id !== id);
    setPeople(next);
    savePeople(next);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <UserRound className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Cadastro de pessoas</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Cadastre o médico e os demais. Depois, na inclusão da família, você escolhe quem entra no grupo.
          </p>
        </div>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" className="sm:col-span-2">
            <TextInput
              value={form.nome}
              onChange={(e) => update("nome", e.target.value)}
              placeholder="Nome completo"
              required
            />
          </Field>
          <Field label="E-mail">
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="Opcional"
            />
          </Field>
          <Field label="Telefone">
            <TextInput
              type="tel"
              value={form.telefone}
              onChange={(e) => update("telefone", e.target.value)}
              placeholder="(11) 99999-0000"
            />
          </Field>
          <Field label="Tipo" className="sm:col-span-2">
            <SelectInput
              value={form.papel}
              onChange={(e) => update("papel", e.target.value as PersonRole)}
            >
              <option value="medico">Médico</option>
              <option value="familiar">Familiar</option>
            </SelectInput>
          </Field>
          {form.papel === "medico" ? (
            <>
              <Field label="CRM">
                <TextInput
                  value={form.crm}
                  onChange={(e) => update("crm", e.target.value)}
                  placeholder="123456"
                  required
                />
              </Field>
              <Field label="UF do CRM">
                <SelectInput value={form.uf} onChange={(e) => update("uf", e.target.value)}>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Especialidade" className="sm:col-span-2">
                <SelectInput
                  value={form.especialidade}
                  onChange={(e) => update("especialidade", e.target.value)}
                >
                  {ESPECIALIDADES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </>
          ) : null}
        </div>

        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/cadastro/familia" className="text-sm text-[var(--color-accent)] hover:underline">
            Ir para inclusão da família
          </Link>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Cadastrar pessoa
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="font-semibold">Pessoas cadastradas</h2>
        {people.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">Nenhuma pessoa ainda.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--color-border)]">
            {people.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{person.nome}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {person.papel === "medico"
                      ? `Médico · CRM ${person.crm}/${person.uf}`
                      : "Familiar"}
                    {person.email ? ` · ${person.email}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(person.id)}
                  className="rounded-lg p-2 text-[var(--color-danger)] hover:bg-[var(--color-surface-elevated)]"
                  aria-label={`Remover ${person.nome}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
