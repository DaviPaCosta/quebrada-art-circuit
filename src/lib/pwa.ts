import { useEffect, useState } from "react";

/** Qual dica de instalação mostrar: Android usa o botão do navegador; iPhone precisa do passo a passo. */
export function installHint(userAgent: string, standalone: boolean): "android" | "ios" | null {
  if (standalone) return null;
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  if (/android/i.test(userAgent)) return "android";
  return null;
}

/** O app foi aberto pelo ícone (tela cheia)? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Liga o "ajudante" que faz o app abrir rápido e mostrar a tela sem internet. */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return; // não atrapalha o desenvolvimento
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallEvent | null = null;
const subscribers = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    subscribers.forEach((s) => s());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    subscribers.forEach((s) => s());
  });
}

/** Estado do botão "Instalar app". */
export function useInstallPrompt() {
  const [, force] = useState(0);
  const [hint, setHint] = useState<"android" | "ios" | null>(null);
  useEffect(() => {
    setHint(installHint(navigator.userAgent, isStandalone()));
    const s = () => force((n) => n + 1);
    subscribers.add(s);
    return () => {
      subscribers.delete(s);
    };
  }, []);
  return {
    hint,
    canPrompt: deferred !== null,
    async install() {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      return outcome === "accepted";
    },
  };
}
