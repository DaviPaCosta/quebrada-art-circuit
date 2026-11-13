import { createFileRoute, Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/vm/AppShell";
import { PostGrid } from "@/components/vm/PostCard";
import { highlightPosts } from "@/lib/logic";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/_rede/destaques")({
  head: () => ({ meta: [{ title: "Destaques — Vozes do Muro" }] }),
  component: Highlights,
});

const DAYS = 30;
const MAX = 60;

function Highlights() {
  const state = useAppState((s) => s);
  const meId = state.sessionUserId!;
  const posts = useMemo(() => highlightPosts(state, meId, Date.now(), { days: DAYS, max: MAX }), [state, meId]);

  return (
    <div className="pb-10">
      <PageTitle kicker="dos últimos 30 dias">Destaques</PageTitle>
      {posts.length > 0 ? (
        <PostGrid posts={posts} />
      ) : (
        <div className="mx-4 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card p-8 text-center sm:mx-0">
          <Star className="size-10 text-accent" aria-hidden />
          <p className="font-bold">Nenhum destaque por enquanto.</p>
          <p className="max-w-sm text-sm text-muted-foreground">Quando houver publicações em destaque, elas aparecem aqui.</p>
          <Button asChild variant="spray">
            <Link to="/feed">Voltar ao feed</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
