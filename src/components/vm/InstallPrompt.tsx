import { Download, Share, SquarePlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { APK_URL, downloadOffer, useInstallPrompt } from "@/lib/pwa";

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

/** Botão flutuante "Baixar app" no canto, acima da barra de navegação. */
export function DownloadAppButton() {
  const { hint, canPrompt, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);
  const offer = downloadOffer(hint, APK_URL, canPrompt);
  if (!offer || dismissed) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* sem armazenamento: some só nesta visita */
    }
  };

  const onClick = async () => {
    if (offer === "instalar") {
      if (await install()) close();
      return;
    }
    if (offer === "apk") return; // o link já baixa
    setOpen((o) => !o);
  };

  const pill =
    "flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_6px_20px_rgba(0,0,0,0.45),2px_2px_0_0_var(--lime)]";

  return (
    <div className="fixed right-3 z-30 flex flex-col items-end gap-2 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+7.5rem)]">
      {open && (
        <div className="w-64 rounded-lg border border-accent/50 bg-card p-4 text-left shadow-xl">
          {offer === "ios" ? (
            <>
              <p className="font-bold">Instalar no iPhone</p>
              <IosSteps />
            </>
          ) : (
            <>
              <p className="font-bold">Instalar no Android</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No Chrome, toque nos três pontinhos ⋮ e escolha <strong className="text-foreground">Instalar app</strong>.
              </p>
            </>
          )}
        </div>
      )}
      <div className="flex items-center gap-1">
        <button type="button" onClick={close} aria-label="Fechar botão de baixar o app" className="rounded-full bg-background/80 p-1.5 text-muted-foreground backdrop-blur">
          <X className="size-4" />
        </button>
        {offer === "apk" && APK_URL ? (
          <a href={APK_URL} download className={pill}>
            <Download className="size-4" /> Baixar app
          </a>
        ) : (
          <button type="button" onClick={() => void onClick()} className={pill} aria-expanded={offer === "instalar" ? undefined : open}>
            <Download className="size-4" /> Baixar app
          </button>
        )}
      </div>
    </div>
  );
}
