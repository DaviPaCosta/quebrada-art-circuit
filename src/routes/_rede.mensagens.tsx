import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/vm/AppShell";

export const Route = createFileRoute("/_rede/mensagens")({
  head: () => ({ meta: [{ title: "Mensagens — Vozes do Muro" }] }),
  component: Messages,
});

/** Placeholder até a Etapa 4 (conversas). */
function Messages() {
  return (
    <div className="pb-10">
      <PageTitle kicker="em breve">Mensagens</PageTitle>
      <div className="mx-4 flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-card p-8 text-center sm:mx-0">
        <MessageCircle className="size-12 text-accent" aria-hidden />
        <p className="text-lg font-bold">As conversas chegam em breve.</p>
        <p className="max-w-sm text-muted-foreground">
          Logo você vai poder trocar mensagens, fotos e vídeos com a galera da escola.
        </p>
        <Button asChild variant="spray">
          <Link to="/feed">Voltar ao feed</Link>
        </Button>
      </div>
    </div>
  );
}
