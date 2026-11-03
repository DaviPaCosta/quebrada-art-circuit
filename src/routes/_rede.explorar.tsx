import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { ArtistCard } from "@/components/vm/ArtistCard";
import { CategoryChips } from "@/components/vm/CategoryChips";
import { PostGrid } from "@/components/vm/PostCard";
import { PageTitle } from "@/components/vm/AppShell";
import { isBlockedBetween, postCover, visiblePosts } from "@/lib/logic";
import { useAppState } from "@/lib/store";
import { CATEGORIES, type Category } from "@/lib/types";
import { MediaImage } from "@/components/vm/media/MediaImage";

type Search = { q?: string | undefined; cat?: Category | undefined };

export const Route = createFileRoute("/_rede/explorar")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s["q"] === "string" && s["q"] ? s["q"] : undefined,
    cat: CATEGORIES.includes(s["cat"] as Category) ? (s["cat"] as Category) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Explorar — Vozes do Muro" },
      { name: "description", content: "Pesquise artistas, estilos e hashtags de arte periférica." },
      { property: "og:title", content: "Explorar — Vozes do Muro" },
      { property: "og:description", content: "Busque grafite, rap, pichação, poesia e muito mais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Explore,
});

function Explore() {
  const { q = "", cat } = Route.useSearch();
  const navigate = Route.useNavigate();
  const state = useAppState((s) => s);
  const meId = state.sessionUserId!;

  const term = q.trim().toLowerCase();
  const tagTerm = term.startsWith("#") ? term.slice(1) : null;

  const posts = useMemo(() => {
    return visiblePosts(state, meId).filter((p) => {
      if (cat && p.category !== cat) return false;
      if (!term) return true;
      if (tagTerm !== null) return p.tags.some((t) => t.includes(tagTerm));
      const author = state.users.find((u) => u.id === p.authorId);
      return [p.title, p.description, p.category, p.credits, ...p.tags, author?.name, author?.username]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [state, meId, cat, term, tagTerm]);

  const artists = useMemo(() => {
    if (!term || tagTerm !== null) return [];
    return state.users.filter(
      (u) =>
        u.id !== meId &&
        !isBlockedBetween(state, meId, u.id) &&
        [u.name, u.username, u.bio, ...u.styles].join(" ").toLowerCase().includes(term),
    );
  }, [state, meId, term, tagTerm]);

  const tags = useMemo(() => {
    const count = new Map<string, number>();
    visiblePosts(state, meId).forEach((p) => p.tags.forEach((t) => count.set(t, (count.get(t) ?? 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [state, meId]);

  const highlight = useMemo(
    () => visiblePosts(state, meId).sort((a, b) => b.likes.length - a.likes.length)[0],
    [state, meId],
  );

  const setSearch = (next: Search) => navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });

  return (
    <div className="pb-8">
      <PageTitle kicker="pesquise a cena">Explorar</PageTitle>
      <div className="space-y-4 px-4 sm:px-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Buscar artistas, estilos e hashtags"
            placeholder="Artistas, estilos ou #hashtags"
            value={q}
            onChange={(e) => setSearch({ q: e.target.value || undefined })}
            className="h-12 pl-10 pr-10 text-base"
          />
          {q && (
            <button onClick={() => setSearch({ q: undefined })} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          )}
        </div>
        <CategoryChips value={cat ?? null} onChange={(c) => setSearch({ cat: c ?? undefined })} />
      </div>

      {!term && !cat && (
        <>
          {highlight && (
            <Link to="/post/$id" params={{ id: highlight.id }} className="group relative mx-4 mt-6 block overflow-hidden rounded-lg border border-border sm:mx-0">
              <MediaImage {...postCover(highlight)} priority sizes="(min-width: 640px) 1024px, 100vw" className="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-80" />
              <div className="bg-fade absolute inset-0" />
              <div className="absolute bottom-0 p-5">
                <span className="tape text-sm">Destaque da semana</span>
                <h2 className="mt-3 text-4xl">{highlight.title}</h2>
              </div>
            </Link>
          )}
          <section className="mt-8 px-4 sm:px-0">
            <h2 className="text-2xl">Hashtags em alta</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map(([t, n]) => (
                <button key={t} onClick={() => setSearch({ q: `#${t}` })} className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent">
                  #{t} <span className="text-muted-foreground">{n}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {artists.length > 0 && (
        <section className="mt-8 px-4 sm:px-0">
          <h2 className="text-2xl">Artistas</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {artists.map((u) => (
              <ArtistCard key={u.id} user={u} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="px-4 text-2xl sm:px-0">{term || cat ? `Obras (${posts.length})` : "Todas as obras"}</h2>
        <div className="mt-3">
          {posts.length ? (
            <PostGrid posts={posts} />
          ) : (
            <p className="px-4 py-10 text-center text-muted-foreground">Nada encontrado. Tente outro termo ou categoria.</p>
          )}
        </div>
      </section>
    </div>
  );
}
