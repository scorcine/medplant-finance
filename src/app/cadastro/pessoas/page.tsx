"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, UserRound } from "lucide-react";
import { Field, SelectInput, TextInput } from "@/components/form-field";
import { loadOwner, loadPeople, saveOwner, savePeople, type Person, type PersonRole } from "@/lib/people";

const blank = (): Omit<Person, "id"> => ({
  nome: "",
  email: "",
  telefone: "",
  papel: "titular",
});

export default function CadastroPessoasPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const loaded = loadPeople();
    setPeople(loaded);
    setOwnerId(loadOwner()?.id ?? "");
    if (loaded.length > 0) setForm({ ...blank(), papel: "familiar" });
  }, []);

  function update<K extends keyof Omit<Person, "id">>(key: K, value: Omit<Person, "id">[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!form.nome.trim() || !email) {
      setError("Informe o nome e o e-mail. O e-mail identifica a agenda dessa pessoa.");
      return;
    }
    if (people.some((person) => person.email.toLowerCase() === email && person.id !== editingId)) {
      setError("Esse e-mail já está cadastrado.");
      return;
    }
    setError("");
    const values = { ...form, nome: form.nome.trim(), email, telefone: form.telefone.trim() };
    let next: Person[];
    if (editingId) {
      next = people.map((person) => (person.id === editingId ? { ...values, id: editingId } : person));
      setNotice("Dados atualizados.");
    } else {
      const created = { ...values, id: crypto.randomUUID() };
      next = [...people, created];
      if (people.length === 0) {
        saveOwner(created.id);
        setOwnerId(created.id);
        setNotice("Seu cadastro foi salvo. Agora o app usa os seus dados.");
      } else {
        setNotice(`${created.nome} foi cadastrado(a).`);
      }
    }
    setPeople(next);
    savePeople(next);
    setEditingId(null);
    setForm({ ...blank(), papel: "familiar" });
  }

  function edit(person: Person) {
    setEditingId(person.id);
    setForm({ nome: person.nome, email: person.email, telefone: person.telefone, papel: person.papel });
    setNotice("");
    setError("");
  }

  function remove(id: string) {
    const next = people.filter((person) => person.id !== id);
    setPeople(next);
    savePeople(next);
    if (id === ownerId && next[0]) {
      saveOwner(next[0].id);
      setOwnerId(next[0].id);
    }
  }

  const isFirst = people.length === 0 && !editingId;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <UserRound className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {isFirst ? "Seu cadastro" : "Cadastro de pessoas"}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {isFirst
              ? "Comece pelos seus dados. Depois cadastre as outras pessoas da família."
              : "Edite os seus dados ou cadastre outra pessoa. Depois, na inclusão da família, ligue as pessoas."}
          </p>
        </div>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-6"
      >
        <h2 className="font-semibold">
          {editingId ? "Editar dados" : isFirst ? "Meus dados" : "Nova pessoa"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" className="sm:col-span-2">
            <TextInput value={form.nome} onChange={(e) => update("nome", e.target.value)} autoComplete="name" required />
          </Field>
          <Field label="E-mail" hint="A agenda do Google dessa pessoa é puxada por este e-mail.">
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Telefone">
            <TextInput type="tel" value={form.telefone} onChange={(e) => update("telefone", e.target.value)} autoComplete="tel" />
          </Field>
          <Field label="Tipo" className="sm:col-span-2">
            <SelectInput value={form.papel} onChange={(e) => update("papel", e.target.value as PersonRole)}>
              <option value="titular">Titular</option>
              <option value="familiar">Familiar</option>
            </SelectInput>
          </Field>
        </div>

        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        {notice ? <p className="text-sm text-[var(--color-success)]">{notice}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/cadastro/familia" className="text-sm text-[var(--color-accent)] hover:underline">
            Ir para inclusão da família
          </Link>
          <div className="flex gap-2">
            {editingId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({ ...blank(), papel: "familiar" });
                }}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
              >
                Cancelar
              </button>
            ) : null}
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              {editingId ? "Salvar alterações" : isFirst ? "Salvar meu cadastro" : "Cadastrar pessoa"}
            </button>
          </div>
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
                  <p className="font-medium">
                    {person.nome}
                    {person.id === ownerId ? (
                      <span className="ml-2 rounded-md bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs text-[var(--color-accent)]">
                        Você
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {person.papel === "familiar" ? "Familiar" : "Titular"} · {person.email}
                    {person.telefone ? ` · ${person.telefone}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {person.id !== ownerId ? (
                    <button
                      type="button"
                      onClick={() => {
                        saveOwner(person.id);
                        setOwnerId(person.id);
                      }}
                      className="rounded-lg px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface-elevated)]"
                    >
                      Sou eu
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => edit(person)}
                    className="rounded-lg p-2 text-[var(--color-muted)] hover:bg-[var(--color-surface-elevated)]"
                    aria-label={`Editar ${person.nome}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(person.id)}
                    className="rounded-lg p-2 text-[var(--color-danger)] hover:bg-[var(--color-surface-elevated)]"
                    aria-label={`Remover ${person.nome}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
