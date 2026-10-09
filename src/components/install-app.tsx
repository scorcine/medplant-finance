"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: InstallPromptEvent | null = null;
let justInstalled = false;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    listeners.forEach((notify) => notify());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    justInstalled = true;
    listeners.forEach((notify) => notify());
  });
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function InstallApp({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const sync = () => setInstalled(justInstalled || isStandalone());
    setIos(isIos());
    sync();
    setReady(true);
    listeners.add(sync);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  if (!ready || installed) return null;

  async function install() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") deferredPrompt = null;
      return;
    }
    setHelp(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={install}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] font-semibold text-white",
          compact ? "px-3 py-1.5 text-xs" : "w-full px-3 py-2.5 text-sm",
          className,
        )}
      >
        <Download className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
        Instalar app
      </button>

      {help ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setHelp(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
            className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon-192.png" alt="" className="h-11 w-11 rounded-xl" />
                <div>
                  <p id="install-title" className="font-semibold">
                    Instalar o MedPlant
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">Abre direto da tela inicial, como um app.</p>
                </div>
              </div>
              <button type="button" onClick={() => setHelp(false)} aria-label="Fechar" className="text-[var(--color-muted)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {ios ? (
              <ol className="mt-5 space-y-3 text-sm">
                <li className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-xs font-semibold text-[var(--color-accent)]">1</span>
                  <span>
                    Abra este site no <strong>Safari</strong> e toque em <strong>Compartilhar</strong>{" "}
                    <Share className="inline h-4 w-4 align-text-bottom text-[var(--color-accent)]" aria-label="ícone Compartilhar" />
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-xs font-semibold text-[var(--color-accent)]">2</span>
                  <span>
                    Role e toque em <strong>Adicionar à Tela de Início</strong>{" "}
                    <SquarePlus className="inline h-4 w-4 align-text-bottom text-[var(--color-accent)]" aria-hidden />
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-xs font-semibold text-[var(--color-accent)]">3</span>
                  <span>
                    Toque em <strong>Adicionar</strong>. O ícone do MedPlant aparece na tela inicial.
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="mt-5 space-y-3 text-sm">
                <li className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-xs font-semibold text-[var(--color-accent)]">1</span>
                  <span>
                    Abra o menu do navegador (<strong>⋮</strong> no Chrome, no canto de cima).
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-xs font-semibold text-[var(--color-accent)]">2</span>
                  <span>
                    Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
                  </span>
                </li>
              </ol>
            )}
            <p className="mt-5 text-xs text-[var(--color-muted)]">
              {ios
                ? "No iPhone, o app da tela inicial guarda os dados separados do Safari: os cadastros e a conexão da agenda precisam ser feitos dentro do app instalado."
                : "O app instalado usa os mesmos dados deste navegador."}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
