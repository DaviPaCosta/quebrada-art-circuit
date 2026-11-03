import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, MessageCircle, ShieldCheck, UserPlus } from "lucide-react";
import { useEffect } from "react";
import { PageTitle } from "@/components/vm/AppShell";
import { FollowButton } from "@/components/vm/ArtistCard";
import { UserAvatar } from "@/components/vm/UserAvatar";
import { MediaImage } from "@/components/vm/media/MediaImage";
import { postCover } from "@/lib/logic";
import { timeAgo } from "@/lib/format";
import { actions, useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/types";

export const Route = createFileRoute("/_rede/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Vozes do Muro" },
      { name: "description", content: "Curtidas, comentários e novos seguidores." },
      { property: "og:title", content: "Notificações — Vozes do Muro" },
      { property: "og:description", content: "Acompanhe as interações com sua arte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Notifications,
});

const ICON = { like: Heart, comment: MessageCircle, follow: UserPlus, moderacao: ShieldCheck };

function Notifications() {
  const meId = useAppState((s) => s.sessionUserId);
  const all = useAppState((s) => s.notifications);
  const items = all.filter((n) => n.userId === meId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // Captura o estado "não lido" antes de marcar tudo como lido.
  const unreadIds = new Set(items.filter((n) => !n.read).map((n) => n.id));

  useEffect(() => {
    const t = window.setTimeout(() => actions.markNotificationsRead(), 1200);
    return () => window.clearTimeout(t);
  }, [items.length]);

  return (
    <div className="mx-auto max-w-xl pb-10">
      <PageTitle kicker="o que rolou">Notificações</PageTitle>
      {items.length === 0 ? (
        <p className="px-6 py-16 text-center text-muted-foreground">Nenhuma notificação ainda. Publique uma obra para começar!</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border sm:rounded-lg sm:border">
          {items.map((n) => (
            <NotificationRow key={n.id} n={n} unread={unreadIds.has(n.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationRow({ n, unread }: { n: AppNotification; unread: boolean }) {
  const actor = useAppState((s) => s.users.find((u) => u.id === n.actorId));
  const post = useAppState((s) => (n.postId ? s.posts.find((p) => p.id === n.postId) : undefined));
  const Icon = ICON[n.type];
  const message =
    n.type === "like"
      ? "curtiu sua publicação"
      : n.type === "comment"
        ? `comentou: “${n.text ?? ""}”`
        : n.type === "follow"
          ? "começou a seguir você"
          : (n.text ?? "aviso da moderação");

  return (
    <li className={cn("flex items-center gap-3 bg-card px-4 py-3", unread && "bg-muted")}>
      <span className="relative">
        <UserAvatar user={actor} size="md" />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5">
          <Icon className={cn("size-4", n.type === "like" ? "fill-primary text-primary" : "text-accent")} />
        </span>
      </span>
      <p className="min-w-0 flex-1 text-sm">
        {actor ? (
          <Link to="/u/$username" params={{ username: actor.username }} className="font-bold hover:underline">
            {actor.username}
          </Link>
        ) : (
          <strong>Alguém</strong>
        )}{" "}
        <span className="text-foreground/90">{message}</span>
        <span className="ml-1 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
      </p>
      {post ? (
        <Link to="/post/$id" params={{ id: post.id }} className="shrink-0">
          <MediaImage {...postCover(post)} alt="" sizes="48px" className="size-12 rounded object-cover" />
        </Link>
      ) : n.type === "follow" && actor ? (
        <FollowButton targetId={actor.id} />
      ) : null}
      {unread && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="não lida" />}
    </li>
  );
}
