import { createFileRoute } from "@tanstack/react-router";
import { PageTitle } from "@/components/vm/AppShell";
import { CuriosityOfDay, NewsList } from "@/components/vm/News";

export const Route = createFileRoute("/_rede/noticias")({
  head: () => ({ meta: [{ title: "Notícias — Vozes do Muro" }] }),
  component: News,
});

function News() {
  return (
    <div className="mx-auto max-w-3xl pb-10">
      <PageTitle kicker="todo dia às 6h">Notícias</PageTitle>
      <CuriosityOfDay />
      <div className="px-4 sm:px-0">
        <NewsList />
      </div>
    </div>
  );
}
