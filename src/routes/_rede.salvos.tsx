import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/vm/AppShell";
import { PostGrid } from "@/components/vm/PostCard";
import { visiblePosts } from "@/lib/logic";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/_rede/salvos")({
  head: () => ({
    meta: [
      { title: "Salvos — Vozes do Muro" },
      { name: "description", content: "Sua coleção pessoal de obras favoritas." },
      { property: "og:title", content: "Salvos — Vozes do Muro" },
      { property: "og:description", content: "Coleção de obras favoritas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Saved,
});

function Saved() {
  const state = useAppState((s) => s);
  const meId = state.sessionUserId!;
  const ids = state.saved[meId] ?? [];
  const posts = visiblePosts(state, meId).filter((p) => ids.includes(p.id));

  return (
    <div className="pb-10">
      <PageTitle kicker="sua coleção">Salvos</PageTitle>
      {posts.length ? (
        <PostGrid posts={posts} />
      ) : (
        <div className="px-6 py-16 text-center">
          <Bookmark className="mx-auto size-12 text-accent" />
          <p className="mt-4 text-muted-foreground">Toque no marcador das publicações para guardar suas obras favoritas aqui.</p>
          <Button asChild variant="spray" className="mt-6">
            <Link to="/explorar">Explorar obras</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
