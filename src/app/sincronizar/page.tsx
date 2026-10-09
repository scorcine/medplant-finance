"use client";

import { useEffect, useState } from "react";
import { Cloud, Copy, LogOut, RefreshCw, Share2 } from "lucide-react";
import { Field, SelectInput, TextInput } from "@/components/form-field";
import { loadOwner, loadPeople, saveOwner, type Person } from "@/lib/people";
import { DATA_EVENT } from "@/lib/records";
import {
  createFamilySync,
  formatCode,
  getSyncCode,
  joinFamilySync,
  leaveFamilySync,
  subscribeSync,
  syncNow,
  type SyncStatus,
} from "@/lib/sync";
import { cn } from "@/lib/utils";

const SITE = "https://finance-henf.vercel.app";

export default function SincronizarPage() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [askOwner, setAskOwner] = useState(false);
  const [serverReady, setServerReady] = useState(true);

  useEffect(() => {
    fetch("/api/sync", { cache: "no-store" })
      .then((response) => response.json())
      .then((json: { ready?: boolean }) => setServerReady(Boolean(json.ready)))
      .catch(() => undefined);
    const refresh = () => {
      setPeople(loadPeople());
      setOwnerId(loadOwner()?.id ?? "");
    };
    refresh();
    setCode(getSyncCode());
    const fromLink = new URLSearchParams(window.location.search).get("codigo");
    if (fromLink) setJoinCode(formatCode(fromLink.toUpperCase().replace(/[^A-Z0-9]/g, "")));
    window.addEventListener(DATA_EVENT, refresh);
    const stop = subscribeSync(setStatus);
    return () => {
      window.removeEventListener(DATA_EVENT, refresh);
      stop();
    };
  }, []);

  const link = code ? `${SITE}/sincronizar?codigo=${code}` : "";

  async function create() {
    setBusy(true);
    setError("");
    try {
      const created = await createFamilySync();
      setCode(created);
      setNotice("Sincronização ativada. Agora envie o link abaixo para a família.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível ativar.");
    } finally {
      setBusy(false);
    }
  }

  async function join(event: React.FormEvent) {
    event.preventDefault();
    if (getSyncCode() === "" && loadPeople().length > 0) {
      const ok = window.confirm("Os dados deste aparelho serão trocados pelos dados da família. Continuar?");
      if (!ok) return;
    }
    setBusy(true);
    setError("");
    try {
      await joinFamilySync(joinCode);
      setCode(getSyncCode());
      setPeople(loadPeople());
      setOwnerId("");
      setAskOwner(true);
      window.history.replaceState(null, "", "/sincronizar");
      setNotice("Pronto! Este aparelho agora usa os dados da família.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  function chooseOwner(id: string) {
    if (!id) return;
    saveOwner(id);
    setOwnerId(id);
    setAskOwner(false);
    setNotice(`Este aparelho agora é de ${people.find((person) => person.id === id)?.nome ?? ""}.`);
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "MedPlant da família", text: "Entre no MedPlant da família por este link:", url: link });
        return;
      }
    } catch {
      return;
    }
    await navigator.clipboard.writeText(link);
    setNotice("Link copiado. Cole no WhatsApp para a Angela.");
  }

  async function copyCode() {
    await navigator.clipboard.writeText(formatCode(code));
    setNotice("Código copiado.");
  }

  function leave() {
    if (!window.confirm("Desconectar este aparelho? Os dados ficam aqui, mas param de sincronizar.")) return;
    leaveFamilySync();
    setCode("");
    setNotice("Este aparelho foi desconectado.");
  }

  const lastSync = status?.lastSync
    ? new Date(status.lastSync).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <Cloud className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Sincronizar aparelhos</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Os mesmos dados no seu celular, no da Angela e no computador. O que um lança, o outro vê.
          </p>
        </div>
      </header>

      {!serverReady || status?.state === "sem-banco" ? (
        <section className="rounded-2xl border border-[var(--color-warning)]/50 bg-[var(--color-surface)] p-5 text-sm">
          <h2 className="font-semibold">Falta ativar o banco de dados na Vercel</h2>
          <p className="mt-1 text-[var(--color-muted)]">Só o dono da conta da Vercel consegue fazer isso, uma única vez:</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            <li>
              Abra{" "}
              <a href="https://vercel.com/dashboard/stores" target="_blank" rel="noreferrer" className="text-[var(--color-accent)] hover:underline">
                vercel.com → Storage
              </a>{" "}
              e clique em <strong>Create Database</strong>.
            </li>
            <li>
              Escolha <strong>Upstash for Redis</strong> (ou <strong>Redis</strong>), plano <strong>Free</strong>, região São Paulo
              (gru1) se houver.
            </li>
            <li>
              Em <strong>Connect Project</strong>, escolha o projeto <strong>finance-henf</strong> (o deste site) e confirme.
              Se já criou o banco ligado a outro projeto, abra o banco em Storage → <strong>Projects</strong> →{" "}
              <strong>Connect Project</strong> e adicione o finance-henf.
            </li>
            <li>
              No projeto <strong>finance-henf</strong>, em Deployments, clique nos três pontinhos do último e em{" "}
              <strong>Redeploy</strong>.
            </li>
          </ol>
        </section>
      ) : null}

      {error ? <p className="rounded-xl bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]">{notice}</p> : null}

      {code ? (
        <>
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--color-muted)]">Situação</p>
                <p
                  className={cn(
                    "font-semibold",
                    status?.state === "erro" || status?.state === "sem-banco" ? "text-[var(--color-danger)]" : "text-[var(--color-success)]",
                  )}
                >
                  {status?.state === "sincronizando"
                    ? "Sincronizando…"
                    : status?.state === "erro" || status?.state === "sem-banco"
                      ? status.message || "Erro ao sincronizar"
                      : "Sincronizado"}
                </p>
                {lastSync ? <p className="text-xs text-[var(--color-muted)]">Última vez: {lastSync}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => void syncNow()}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
              >
                <RefreshCw className={cn("h-4 w-4", status?.state === "sincronizando" && "animate-spin")} aria-hidden />
                Sincronizar agora
              </button>
            </div>
          </section>

          <section
            className={cn(
              "rounded-2xl border bg-[var(--color-surface)] p-5",
              askOwner ? "border-[var(--color-accent)]" : "border-[var(--color-border)]",
            )}
          >
            <h2 className="font-semibold">Quem usa este aparelho?</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Define de quem é o &quot;Meus dados&quot; e quem aparece como pagador padrão neste aparelho.
            </p>
            <div className="mt-3 max-w-xs">
              <SelectInput value={askOwner ? "" : ownerId} onChange={(event) => chooseOwner(event.target.value)}>
                {askOwner ? <option value="">Escolha…</option> : null}
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.nome}
                  </option>
                ))}
              </SelectInput>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="font-semibold">Conectar outro aparelho</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Envie este link para a Angela. Ela abre no celular, toca em <strong>Entrar na família</strong> e escolhe o nome dela.
              Guarde o código: quem tiver ele vê os dados da família.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void share()}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Share2 className="h-4 w-4" aria-hidden />
                Enviar link
              </button>
              <button
                type="button"
                onClick={() => void copyCode()}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium"
              >
                <Copy className="h-4 w-4" aria-hidden />
                Copiar código
              </button>
            </div>
            <p className="mt-3 font-mono text-sm tracking-wider">{formatCode(code)}</p>
          </section>

          <button
            type="button"
            onClick={leave}
            className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-danger)]"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Desconectar este aparelho
          </button>
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="font-semibold">Entrar na família</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Use o link ou o código que recebeu. Os dados deste aparelho são trocados pelos dados da família.
            </p>
            <form onSubmit={join} className="mt-4 space-y-3">
              <Field label="Código da família">
                <TextInput
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                  autoCapitalize="characters"
                  autoComplete="off"
                  required
                />
              </Field>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                Entrar na família
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="font-semibold">Começar a sincronizar</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Faça isto no aparelho que já tem os cadastros. Os dados dele viram os dados da família e você recebe um link para
              enviar aos outros.
            </p>
            <button
              type="button"
              onClick={() => void create()}
              disabled={busy}
              className="mt-4 rounded-xl border border-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent)] disabled:opacity-60"
            >
              Ativar sincronização
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
