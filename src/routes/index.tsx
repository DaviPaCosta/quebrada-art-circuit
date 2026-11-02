import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/vm/Logo";
import { useCurrentUser } from "@/lib/store";
import { cn } from "@/lib/utils";
import hero from "@/assets/hero-muro.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vozes do Muro — rede social de artes periféricas" },
      {
        name: "description",
        content: "Divulgue artistas, compartilhe obras e aprenda sobre grafite, rap, pichação, poesia e cultura das periferias.",
      },
      { property: "og:title", content: "Vozes do Muro — rede social de artes periféricas" },
      { property: "og:description", content: "Grafite, rap, pichação, poesia e dança: uma rede para valorizar a cultura urbana." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const user = useCurrentUser();
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setSplash(false), 1600);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* 01. Abertura */}
      <div
        aria-hidden={!splash}
        className={cn(
          "concrete fixed inset-0 z-20 flex flex-col items-center justify-center gap-4 transition-opacity duration-700",
          splash ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="animate-spray-in">
          <Logo size="xl" />
        </div>
        <p className="font-marker text-lg text-accent animate-spray-in [animation-delay:300ms]">arte que vem da quebrada</p>
      </div>

      {/* 02. Boas-vindas */}
      <img src={hero} alt="" width={1088} height={1920} className="absolute inset-0 size-full object-cover opacity-70" />
      <div className="bg-fade absolute inset-0" />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-end px-6 pb-10 pt-16">
        <Logo size="lg" />
        <h1 className="mt-6 text-5xl leading-[0.95] text-foreground sm:text-6xl">
          A periferia <span className="text-spray-gradient">pinta, rima</span> e escreve a cidade.
        </h1>
        <p className="mt-4 text-base text-foreground/85">
          Uma rede social educativa para divulgar artistas, compartilhar obras e valorizar grafite, rap, pichação,
          poesia, dança e toda a cultura urbana — com respeito às comunidades.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          {user ? (
            <Button asChild variant="spray" size="lg">
              <Link to="/feed">Entrar no feed, {user.name.split(" ")[0]}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="spray" size="lg">
                <Link to="/cadastro">Criar conta</Link>
              </Button>
              <Button asChild variant="sand" size="lg">
                <Link to="/entrar">Entrar</Link>
              </Button>
            </>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Projeto escolar · contas e dados são simulados e ficam salvos só neste aparelho.
        </p>
      </div>
    </div>
  );
}
