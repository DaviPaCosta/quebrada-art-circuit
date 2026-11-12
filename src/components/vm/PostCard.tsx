import { Link, useNavigate } from "@tanstack/react-router";
import { Bookmark, Clapperboard, Flag, GalleryHorizontal, Heart, MessageCircle, MoreHorizontal, Share2, ShieldOff, Trash2 } from "lucide-react";
import { memo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { actions, useAppState } from "@/lib/store";
import { postCover } from "@/lib/logic";
import { plural, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Post } from "@/lib/types";
import { UserAvatar } from "./UserAvatar";
import { CategoryTag } from "./CategoryChips";
import { ReportDialog } from "./ReportDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { MediaImage } from "./media/MediaImage";
import { MentionText } from "./Mentions";
import { MediaViewer } from "./media/MediaViewer";

export const PostCard = memo(function PostCard({
  post,
  detail = false,
  priority = false,
}: {
  post: Post;
  detail?: boolean;
  /** Primeira publicação visível: carrega a imagem antes das outras. */
  priority?: boolean;
}) {
  const navigate = useNavigate();
  const author = useAppState((s) => s.users.find((u) => u.id === post.authorId));
  const meId = useAppState((s) => s.sessionUserId);
  const saved = useAppState((s) => (meId ? (s.saved[meId] ?? []).includes(post.id) : false));
  const commentCount = useAppState((s) => s.comments.filter((c) => c.postId === post.id).length);
  const liked = !!meId && post.likes.includes(meId);
  const isMine = meId === post.authorId;

  const [heart, setHeart] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const lastTap = useRef(0);

  const onImageTap = () => {
    const t = Date.now();
    if (t - lastTap.current < 300) {
      if (!liked) actions.toggleLike(post.id);
      setHeart((h) => h + 1);
    }
    lastTap.current = t;
  };

  const share = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: post.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado!");
      }
    } catch {
      /* compartilhamento cancelado */
    }
  };

  return (
    <article className="border-b border-border bg-card sm:rounded-lg sm:border">
      <header className="flex items-center gap-3 px-3 py-2.5">
        <Link to="/u/$username" params={{ username: author?.username ?? "" }} className="flex min-w-0 items-center gap-3">
          <UserAvatar user={author} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{author?.name ?? "Conta removida"}</span>
            <span className="block truncate text-xs text-muted-foreground">
              @{author?.username} · {timeAgo(post.createdAt)}
            </span>
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <CategoryTag category={post.category} />
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Mais opções" className="rounded-full p-1.5 hover:bg-muted">
              <MoreHorizontal className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => actions.toggleSave(post.id)}>
                <Bookmark /> {saved ? "Remover dos salvos" : "Salvar"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={share}>
                <Share2 /> Compartilhar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isMine ? (
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 /> Excluir publicação
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => setReportOpen(true)}>
                    <Flag /> Denunciar
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setBlockOpen(true)}>
                    <ShieldOff /> Bloquear @{author?.username}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="relative select-none bg-muted" onClick={onImageTap}>
        {detail || post.type !== "imagem" ? (
          <MediaViewer media={post.media} detail={detail} priority={priority} />
        ) : (
          <Link to="/post/$id" params={{ id: post.id }} onClick={(e) => e.detail > 1 && e.preventDefault()} aria-label={`Abrir publicação ${post.title}`}>
            <MediaViewer media={post.media} priority={priority} />
          </Link>
        )}
        {heart > 0 && (
          <Heart key={heart} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 animate-pop-heart fill-primary text-primary" />
        )}
      </div>

      <div className="px-3 pb-3 pt-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => actions.toggleLike(post.id)}
            aria-pressed={liked}
            aria-label={liked ? "Descurtir" : "Curtir"}
            className="rounded-full p-2 hover:bg-muted"
          >
            <Heart className={cn("size-6 transition-transform active:scale-125", liked && "fill-primary text-primary")} />
          </button>
          <button
            onClick={() => navigate({ to: "/post/$id", params: { id: post.id }, hash: "comentar" })}
            aria-label="Comentar"
            className="rounded-full p-2 hover:bg-muted"
          >
            <MessageCircle className="size-6" />
          </button>
          <button onClick={share} aria-label="Compartilhar" className="rounded-full p-2 hover:bg-muted">
            <Share2 className="size-6" />
          </button>
          <button
            onClick={() => {
              actions.toggleSave(post.id);
              toast(saved ? "Removido dos salvos" : "Salvo na sua coleção");
            }}
            aria-pressed={saved}
            aria-label={saved ? "Remover dos salvos" : "Salvar"}
            className="ml-auto rounded-full p-2 hover:bg-muted"
          >
            <Bookmark className={cn("size-6", saved && "fill-accent text-accent")} />
          </button>
        </div>
        <p className="px-1 text-sm font-bold">{plural(post.likes.length, "curtida", "curtidas")}</p>
        {detail ? (
          <h2 className="mt-2 px-1 text-2xl">{post.title}</h2>
        ) : (
          <h2 className="mt-2 px-1 text-2xl">
            <Link to="/post/$id" params={{ id: post.id }} className="hover:text-primary">
              {post.title}
            </Link>
          </h2>
        )}
        <p className={cn("mt-1 whitespace-pre-line px-1 text-sm leading-relaxed text-foreground/90", !detail && "line-clamp-3")}>
          <MentionText text={post.description} />
        </p>
        {post.credits && (
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/80">Créditos:</span> <MentionText text={post.credits} />
          </p>
        )}
        {post.region && (
          <p className="mt-1 px-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/80">Região:</span> {post.region}
          </p>
        )}
        {post.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-2 px-1">
            {post.tags.map((t) => (
              <Link key={t} to="/explorar" search={{ q: `#${t}` }} className="text-sm font-semibold text-accent hover:underline">
                #{t}
              </Link>
            ))}
          </div>
        )}
        {!detail && commentCount > 0 && (
          <Link to="/post/$id" params={{ id: post.id }} className="mt-2 block px-1 text-sm text-muted-foreground hover:text-foreground">
            Ver {plural(commentCount, "comentário", "comentários")}
          </Link>
        )}
      </div>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="post" targetId={post.id} label="publicação" />
      <ConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title={`Bloquear @${author?.username}?`}
        description="Você não verá mais as publicações dessa pessoa e ela não verá as suas. Dá para desbloquear nas configurações."
        confirmLabel="Bloquear"
        destructive
        onConfirm={() => {
          actions.toggleBlock(post.authorId);
          toast.success("Perfil bloqueado");
          if (detail) navigate({ to: "/feed" });
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir publicação?"
        description="Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => {
          actions.deletePost(post.id);
          toast.success("Publicação excluída");
          if (detail) navigate({ to: "/feed" });
        }}
      />
    </article>
  );
});

export function PostGrid({ posts }: { posts: Post[] }) {
  return (
    <ul className="grid grid-cols-3 gap-0.5 sm:gap-2">
      {posts.map((p) => (
        <li key={p.id}>
          <GridItem post={p} />
        </li>
      ))}
    </ul>
  );
}

const GridItem = memo(function GridItem({ post: p }: { post: Post }) {
  const cover = postCover(p);
  return (
          <Link to="/post/$id" params={{ id: p.id }} className="group relative block aspect-square overflow-hidden bg-muted sm:rounded-md">
            <MediaImage
              src={cover.src}
              alt={cover.alt}
              width={cover.width}
              height={cover.height}
              sizes="(min-width: 640px) 320px, 33vw"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {p.type !== "imagem" && (
              <span className="absolute right-1.5 top-1.5 rounded bg-background/70 p-1" aria-label={p.type === "video" ? "Vídeo" : "Carrossel"}>
                {p.type === "video" ? <Clapperboard className="size-3.5" /> : <GalleryHorizontal className="size-3.5" />}
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center gap-1 bg-background/60 font-bold opacity-0 transition-opacity group-hover:opacity-100">
              <Heart className="size-4 fill-foreground" /> {p.likes.length}
            </span>
          </Link>
  );
});
