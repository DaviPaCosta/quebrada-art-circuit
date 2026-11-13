import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArtistCard } from "@/components/vm/ArtistCard";
import { PostCard } from "@/components/vm/PostCard";
import { StoryBar } from "@/components/vm/stories/StoryBar";
import { isBlockedBetween, visiblePosts } from "@/lib/logic";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_rede/feed")({
  head: () => ({
    meta: [
      { title: "Feed — Vozes do Muro" },
      { name: "description", content: "Últimas obras de grafite, rap, poesia e arte periférica." },
      { property: "og:title", content: "Feed — Vozes do Muro" },
      { property: "og:description", content: "As obras mais recentes da comunidade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Feed,
});

const PAGE_SIZE = 10;

function Feed() {
  const [tab, setTab] = useState<"todos" | "seguindo">("todos");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const sentinel = useRef<HTMLDivElement>(null);
  const state = useAppState((s) => s);
  const meId = state.sessionUserId!;
  const following = state.follows[meId] ?? [];

  const posts = useMemo(() => {
    const all = visiblePosts(state, meId);
    return tab === "todos" ? all : all.filter((p) => following.includes(p.authorId) || p.authorId === meId);
  }, [state, meId, tab, following]);

  const shown = posts.slice(0, limit);
  const hasMore = posts.length > limit;

  // Carrega mais 10 publicações quando a pessoa chega perto do fim.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setLimit((l) => l + PAGE_SIZE), {
      rootMargin: "600px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, limit]);

  const suggestions = state.users.filter(
    (u) => u.id !== meId && !following.includes(u.id) && !isBlockedBetween(state, meId, u.id),
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="mx-auto w-full min-w-0 max-w-xl">
        <StoryBar />

        <div role="tablist" className="sticky top-14 z-20 mt-3 flex border-b border-border bg-background/95 backdrop-blur">
          {(["todos", "seguindo"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setLimit(PAGE_SIZE);
              }}
              className={cn(
                "flex-1 py-3 font-display text-lg uppercase tracking-wide text-muted-foreground",
                tab === t && "border-b-2 border-primary text-foreground",
              )}
            >
              {t === "todos" ? "Para você" : "Seguindo"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-0 sm:gap-6 sm:pt-6">
          {shown.map((p, i) => (
            <PostCard key={p.id} post={p} priority={i === 0} />
          ))}
          {hasMore && (
            <div ref={sentinel} className="flex justify-center py-6">
              <Button variant="sand" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Carregar mais
              </Button>
            </div>
          )}
          {posts.length === 0 && (
            <div className="px-6 py-16 text-center">
              <p className="font-marker text-xl text-accent">Muro vazio por aqui</p>
              {tab === "todos" ? (
                <>
                  <p className="mt-2 text-muted-foreground">Seja a primeira pessoa a postar!</p>
                  <Button asChild variant="spray" className="mt-6">
                    <Link to="/publicar">Publicar agora</Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="mt-2 text-muted-foreground">Siga artistas para ver as obras deles nesta aba.</p>
                  <Button asChild variant="spray" className="mt-6">
                    <Link to="/explorar">Explorar artistas</Link>
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <aside className="hidden pt-6 lg:block">
        <div className="sticky top-20 space-y-3">
          <h2 className="text-xl">Artistas para seguir</h2>
          {suggestions.slice(0, 5).map((u) => (
            <ArtistCard key={u.id} user={u} />
          ))}
          <p className="pt-4 text-xs text-muted-foreground">
            Vozes do Muro · projeto escolar ·{" "}
            <Link to="/regras" className="underline">
              regras de convivência
            </Link>
          </p>
        </div>
      </aside>
    </div>
  );
}
