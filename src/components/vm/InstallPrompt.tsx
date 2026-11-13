import { Download, Share, SquarePlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/lib/pwa";

const DISMISS_KEY = "vozes-do-muro:instalar-dispensado";

/** Passo a passo para iPhone (o Safari não deixa sites mostrarem botão de instalar). */
function IosSteps() {
  return (
    <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
      <li className="flex items-center gap-2">
        1. Toque em <Share className="size-4 text-foreground" aria-label="Compartilhar" /> <strong className="text-foreground">Compartilhar</strong>
      </li>
      <li className="flex items-center gap-2">
        2. Escolha <SquarePlus className="size-4 text-foreground" aria-hidden /> <strong className="text-foreground">Adicionar à Tela de Início</strong>
      </li>
      <li>3. Toque em <strong className="text-foreground">Adicionar</strong></li>
    </ol>
  );
}

/** Botão/explicação de instalar, para a tela de Configurações. */
export function InstallSection() {
  const { hint, canPrompt, install } = useInstallPrompt();
  if (!hint) return null;
  return (
    <div className="p-4">
      <p className="font-semibold">Instalar o app</p>
      <p className="text-sm text-muted-foreground">Ícone na tela inicial e tela cheia, como um app.</p>
      {hint === "ios" ? (
        <IosSteps />
      ) : canPrompt ? (
        <Button variant="spray" className="mt-3" onClick={() => void install()}>
          <Download /> Instalar app
        </Button>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No Chrome, toque nos três pontinhos e escolha <strong className="text-foreground">Instalar app</strong>.
        </p>
      )}
    </div>
  );
}

/** Aviso discreto no feed, na primeira visita pelo navegador do celular. */
export function InstallBanner() {
  const { hint, canPrompt, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);
  if (!hint || dismissed || (hint === "android" && !canPrompt)) return null;
  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* sem armazenamento: some só nesta visita */
    }
  };
  return (
    <div className="relative mx-4 mt-3 rounded-lg border border-accent/50 bg-card p-4 pr-10 sm:mx-0">
      <button type="button" onClick={close} aria-label="Fechar aviso" className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-muted">
        <X className="size-4" />
      </button>
      <p className="font-display text-lg uppercase">Tenha o Vozes do Muro como app</p>
      {hint === "ios" ? (
        <IosSteps />
      ) : (
        <Button
          variant="spray"
          size="sm"
          className="mt-2"
          onClick={async () => {
            if (await install()) close();
          }}
        >
          <Download /> Instalar app
        </Button>
      )}
    </div>
  );
}
