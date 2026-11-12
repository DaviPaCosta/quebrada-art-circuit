import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Flag, Send, Trash2, Heart, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MentionInput, MentionText } from "@/components/vm/Mentions";
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
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
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
    actions.addComment(post.id, text, replyTo?.id);
    setReplyTo(null);
    setText("");
  };

  return (
    <div className="mx-auto max-w-xl pb-10 sm:pt-4">
      <Button variant="ghost" onClick={() => router.history.back()} className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground sm:px-0">
        <ArrowLeft className="size-4" /> Voltar
      </Button>
      <PostCard post={post} detail />

      <section aria-labelledby="comentarios" className="mt-4 px-4 sm:px-0">
        <h2 id="comentarios" className="text-2xl">
          Comentários ({comments.length})
        </h2>
        <ul className="mt-4 space-y-4">
          {comments.filter((c) => !c.parentId || !comments.some((p) => p.id === c.parentId)).map((c) => (
            <li key={c.id}><ul className="space-y-3"><CommentItem comment={c} postAuthorId={post.authorId} meId={me?.id ?? ""} onReply={(comment) => { setReplyTo(comment); inputRef.current?.focus(); }} />{comments.filter((r) => r.parentId === c.id).map((r) => <div key={r.id} className="ml-7 border-l border-border pl-3"><CommentItem comment={r} postAuthorId={post.authorId} meId={me?.id ?? ""} onReply={(comment) => { setReplyTo(comment); inputRef.current?.focus(); }} /></div>)}</ul></li>
          ))}
          {comments.length === 0 && <li className="text-sm text-muted-foreground">Seja a primeira pessoa a comentar.</li>}
        </ul>
        {replyTo && <div className="mt-4 flex items-center justify-between border-l-2 border-accent bg-muted px-3 py-2 text-sm"><span className="min-w-0 truncate">Respondendo: {replyTo.text}</span><Button variant="ghost" size="icon" aria-label="Cancelar resposta" onClick={() => setReplyTo(null)}><X /></Button></div>}
        <form id="comentar" onSubmit={submit} className="sticky bottom-20 mt-6 flex items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-2 md:bottom-4">
          <UserAvatar user={me} size="sm" />
          <MentionInput
            ref={inputRef}
            value={text}
            onChange={setText}
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

function CommentItem({ comment, postAuthorId, meId, onReply }: { comment: Comment; postAuthorId: string; meId: string; onReply: (comment: Comment) => void }) {
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
          <span className="break-words text-foreground/90"><MentionText text={comment.text} /></span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{timeAgo(comment.createdAt)}</span>
          <Button variant="ghost" size="sm" className="h-7 px-1 text-xs" onClick={() => onReply(comment)}>Responder</Button>
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
      <Button variant="ghost" size="sm" aria-label="Curtir comentário" aria-pressed={comment.likes.includes(meId)} onClick={() => actions.toggleCommentLike(comment.id)} className="shrink-0 px-1"><Heart className={comment.likes.includes(meId) ? "fill-primary text-primary" : "text-muted-foreground"} /><span>{comment.likes.length}</span></Button>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="comment" targetId={comment.id} label="comentário" />
    </li>
  );
}
