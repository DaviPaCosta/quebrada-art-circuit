import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, Clapperboard, Heart, MessageCircle } from "lucide-react";
import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/vm/media/VideoPlayer";
import { UserAvatar } from "@/components/vm/UserAvatar";
import { visiblePosts } from "@/lib/logic";
import { actions, useAppState } from "@/lib/store";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_rede/reels")({
  head: () => ({
    meta: [
      { title: "Reels — Vozes do Muro" },
      { name: "description", content: "Vídeos verticais de grafite, break, rap e slam da comunidade." },
      { property: "og:title", content: "Reels — Vozes do Muro" },
      { property: "og:description", content: "Vídeos curtos da cena periférica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reels,
});

function Reels() {
  const state = useAppState((s) => s);
  const meId = state.sessionUserId;
  const reels = useMemo(() => visiblePosts(state, meId).filter((p) => p.media[0]?.kind === "video"), [state, meId]);

  if (reels.length === 0) {
    return (
      <div className="px-6 py-20 text-center">
        <Clapperboard className="mx-auto size-12 text-primary" />
        <p className="mt-4 font-marker text-xl text-accent">Nenhum vídeo ainda</p>
        <p className="mt-2 text-muted-foreground">Publique um vídeo curto para inaugurar os Reels.</p>
        <Button asChild variant="spray" className="mt-6">
          <Link to="/publicar">Publicar vídeo</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="sr-only">Reels</h1>
      <div className="scrollbar-none h-[calc(100dvh-3.5rem-4.25rem)] snap-y snap-mandatory overflow-y-auto overscroll-y-contain md:h-[calc(100dvh-3.5rem)] md:py-4">
        {reels.map((p) => (
          <ReelCard key={p.id} post={p} meId={meId} />
        ))}
      </div>
    </div>
  );
}

const ReelCard = memo(function ReelCard({ post, meId }: { post: Post; meId: string | null }) {
  const m = post.media[0]!;
  const author = useAppState((s) => s.users.find((u) => u.id === post.authorId));
  const saved = useAppState((s) => (meId ? (s.saved[meId] ?? []).includes(post.id) : false));
  const comments = useAppState((s) => s.comments.filter((c) => c.postId === post.id).length);
  const liked = !!meId && post.likes.includes(meId);

  return (
    <section className="relative h-full snap-start snap-always md:mb-4 md:overflow-hidden md:rounded-xl" aria-label={post.title}>
      <VideoPlayer src={m.src} poster={m.poster} alt={m.alt} width={m.width} height={m.height} className="size-full" large />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/50 to-transparent p-4 pr-20 pt-16">
        <Link to="/u/$username" params={{ username: author?.username ?? "" }} className="pointer-events-auto flex items-center gap-2">
          <UserAvatar user={author} size="sm" />
          <span className="text-sm font-bold">@{author?.username}</span>
        </Link>
        <h2 className="mt-2 text-2xl">{post.title}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-foreground/90">{post.description}</p>
        <p className="mt-1 text-xs text-muted-foreground">Créditos: {post.credits}</p>
      </div>

      <div className="absolute bottom-20 right-2 flex flex-col items-center gap-3">
        <ReelAction label={liked ? "Descurtir" : "Curtir"} count={post.likes.length} pressed={liked} onClick={() => actions.toggleLike(post.id)}>
          <Heart className={cn("size-6", liked && "fill-primary text-primary")} />
        </ReelAction>
        <Link
          to="/post/$id"
          params={{ id: post.id }}
          hash="comentar"
          aria-label="Comentar"
          className="flex flex-col items-center gap-0.5 text-xs font-bold"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm">
            <MessageCircle className="size-6" />
          </span>
          {comments}
        </Link>
        <ReelAction label={saved ? "Remover dos salvos" : "Salvar"} pressed={saved} onClick={() => actions.toggleSave(post.id)}>
          <Bookmark className={cn("size-6", saved && "fill-accent text-accent")} />
        </ReelAction>
      </div>
    </section>
  );
});

function ReelAction({
  label,
  count,
  pressed,
  onClick,
  children,
}: {
  label: string;
  count?: number;
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={pressed} className="flex flex-col items-center gap-0.5 text-xs font-bold">
      <span className="flex size-11 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm">{children}</span>
      {count !== undefined && count}
    </button>
  );
}
