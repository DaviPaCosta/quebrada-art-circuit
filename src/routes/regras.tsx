import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/vm/Logo";
import { REGRAS } from "@/lib/cultura";

export const Route = createFileRoute("/regras")({
  head: () => ({
    meta: [
      { title: "Regras de convivência — Vozes do Muro" },
      { name: "description", content: "Respeito, crédito, autorização de imagem e segurança: as regras da comunidade Vozes do Muro." },
      { property: "og:title", content: "Regras de convivência — Vozes do Muro" },
      { property: "og:description", content: "Como convivemos na rede de artes periféricas." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Rules,
});

function Rules() {
  const router = useRouter();
  return (
    <div className="concrete min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.history.back()} aria-label="Voltar" className="rounded-full p-2 hover:bg-muted">
            <ArrowLeft className="size-5" />
          </button>
          <Link to="/">
            <Logo />
          </Link>
          <span className="w-9" />
        </div>
        <p className="mt-10 font-marker text-accent">combinado não sai caro</p>
        <h1 className="text-5xl">Regras de convivência</h1>
        <ol className="mt-8 space-y-4">
          {REGRAS.map((r, i) => (
            <li key={r.title} className="flex gap-4 rounded-lg border border-border bg-card p-5">
              <span className="font-display text-4xl text-primary">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h2 className="text-2xl">{r.title}</h2>
                <p className="mt-1 text-foreground/90">{r.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-muted-foreground">
          Quem descumprir as regras pode ter publicações removidas pela moderação. Em caso de dúvida, fale com um
          professor responsável.
        </p>
      </div>
    </div>
  );
}
