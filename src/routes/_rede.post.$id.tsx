import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Flag, Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PostCard } from "@/components/vm/PostCard";
import { ReportDialog } from "@/components/vm/ReportDialog";
import { UserAvatar } from "@/components/vm/UserAvatar";
import { isBlockedBetween } from "@/lib/logic";
import { actions, useAppState, useCurrentUser } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import type { Comment } from "@/lib/types";

export const Route = createFileRoute("/_rede/post/$id")({
  head: () => ({
    meta: [
      { title: "Publicação — Vozes do Muro" },
      { name: "description", content: "Veja a obra, os créditos e os comentários da comunidade." },
      { property: "og:title", content: "Publicação — Vozes do Muro" },
      { property: "og:description", content: "Uma obra compartilhada na rede de artes periféricas." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PostDetail,
});

function PostDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const me = useCurrentUser();
  const post = useAppState((s) => s.posts.find((p) => p.id === id && !p.removed));
  const blocked = useAppState((s) => (post && me ? isBlockedBetween(s, me.id, post.authorId) : false));
  const comments = useAppState((s) => s.comments)
    .filter((c) => c.postId === id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.location.hash === "#comentar") inputRef.current?.focus();
  }, []);

  if (!post || blocked) {
    return (
      <div className="px-6 py-20 text-center">
        <h1 className="text-4xl">Publicação indisponível</h1>
        <p className="mt-2 text-muted-foreground">Ela pode ter sido removida ou você não tem acesso.</p>
        <Button asChild variant="spray" className="mt-6">
          <Link to="/feed">Voltar ao feed</Link>
        </Button>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    actions.addComment(post.id, text);
    setText("");
  };

  return (
    <div className="mx-auto max-w-xl pb-10 sm:pt-4">
      <button onClick={() => router.history.back()} className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground sm:px-0">
        <ArrowLeft className="size-4" /> Voltar
      </button>
      <PostCard post={post} detail />

      <section aria-labelledby="comentarios" className="mt-4 px-4 sm:px-0">
        <h2 id="comentarios" className="text-2xl">
          Comentários ({comments.length})
        </h2>
        <ul className="mt-4 space-y-4">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} postAuthorId={post.authorId} meId={me?.id ?? ""} />
          ))}
          {comments.length === 0 && <li className="text-sm text-muted-foreground">Seja a primeira pessoa a comentar.</li>}
        </ul>
        <form id="comentar" onSubmit={submit} className="sticky bottom-20 mt-6 flex items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-2 md:bottom-4">
          <UserAvatar user={me} size="sm" />
          <Input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva um comentário respeitoso..."
            aria-label="Escreva um comentário"
            maxLength={500}
            className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button type="submit" size="icon" className="rounded-full" disabled={!text.trim()} aria-label="Enviar comentário">
            <Send />
          </Button>
        </form>
      </section>
    </div>
  );
}

function CommentItem({ comment, postAuthorId, meId }: { comment: Comment; postAuthorId: string; meId: string }) {
  const author = useAppState((s) => s.users.find((u) => u.id === comment.authorId));
  const hidden = useAppState((s) => isBlockedBetween(s, meId, comment.authorId));
  const [reportOpen, setReportOpen] = useState(false);
  if (hidden) return null;
  const canDelete = comment.authorId === meId || postAuthorId === meId;
  return (
    <li className="group flex gap-3">
      <Link to="/u/$username" params={{ username: author?.username ?? "" }}>
        <UserAvatar user={author} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <Link to="/u/$username" params={{ username: author?.username ?? "" }} className="font-bold hover:underline">
            {author?.username ?? "conta removida"}
          </Link>{" "}
          <span className="text-foreground/90">{comment.text}</span>
        </p>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{timeAgo(comment.createdAt)}</span>
          {comment.authorId !== meId && (
            <button onClick={() => setReportOpen(true)} className="flex items-center gap-1 hover:text-foreground">
              <Flag className="size-3" /> Denunciar
            </button>
          )}
          {canDelete && (
            <button onClick={() => actions.deleteComment(comment.id)} className="flex items-center gap-1 hover:text-destructive">
              <Trash2 className="size-3" /> Excluir
            </button>
          )}
        </div>
      </div>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="comment" targetId={comment.id} label="comentário" />
    </li>
  );
}
