import { useEffect, useState } from "react";

/** Qual dica de instalação mostrar: Android usa o botão do navegador; iPhone precisa do passo a passo. */
export function installHint(userAgent: string, standalone: boolean): "android" | "ios" | null {
  if (standalone) return null;
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  // iPad novo se apresenta como Mac; quem tem toque é iPad.
  if (/macintosh/i.test(userAgent) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1) return "ios";
  if (/android/i.test(userAgent)) return "android";
  return null;
}

/** Endereço do APK no próprio site (null até o APK ser gerado no PWABuilder). */
export const APK_URL: string | null = "/app/vozes-do-muro.apk";

/** O que o botão "Baixar app" faz neste aparelho. */
export function downloadOffer(
  hint: "android" | "ios" | null,
  apkUrl: string | null,
  canPrompt: boolean,
  standalone = false,
): "apk" | "instalar" | "menu" | "ios" | "computador" | null {
  if (standalone) return null; // já está no app
  if (hint === "ios") return "ios";
  if (hint !== "android") return "computador";
  if (apkUrl) return "apk";
  return canPrompt ? "instalar" : "menu";
}

/** Quem fechou o botão não vê de novo por 7 dias. */
export const DISMISS_DAYS = 7;
export function dismissedRecently(stored: string | null, nowMs: number): boolean {
  const at = Number(stored);
  if (!stored || !Number.isFinite(at)) return false;
  return nowMs - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
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
  const register = () => void navigator.serviceWorker.register("/sw.js").catch(() => {});
  // Se a página já terminou de carregar, registra agora (o evento "load" não volta a acontecer).
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
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
  const [standalone, setStandalone] = useState(true); // até saber, não mostra nada
  useEffect(() => {
    setStandalone(isStandalone());
    setHint(installHint(navigator.userAgent, isStandalone()));
    const s = () => force((n) => n + 1);
    subscribers.add(s);
    return () => {
      subscribers.delete(s);
    };
  }, []);
  return {
    hint,
    standalone,
    canPrompt: deferred !== null,
    async install() {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      subscribers.forEach((s) => s());
      return outcome === "accepted";
    },
  };
}
