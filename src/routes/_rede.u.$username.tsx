import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Archive, Flag, Grid3x3, MapPin, MoreHorizontal, Settings, ShieldOff, Pin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArtistCard, FollowButton } from "@/components/vm/ArtistCard";
import { ConfirmDialog } from "@/components/vm/ConfirmDialog";
import { PostGrid } from "@/components/vm/PostCard";
import { ReportDialog } from "@/components/vm/ReportDialog";
import { UserAvatar } from "@/components/vm/UserAvatar";
import { archivedPosts, isBlockedBetween, visiblePosts, postCover } from "@/lib/logic";
import { MediaImage } from "@/components/vm/media/MediaImage";
import { MentionText } from "@/components/vm/Mentions";
import { cn } from "@/lib/utils";
import { actions, useAppState } from "@/lib/store";

export const Route = createFileRoute("/_rede/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — Vozes do Muro` },
      { name: "description", content: `Obras e perfil de @${params.username} no Vozes do Muro.` },
      { property: "og:title", content: `@${params.username} — Vozes do Muro` },
      { property: "og:description", content: "Perfil de artista na rede de artes periféricas." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { username } = Route.useParams();
  const navigate = useNavigate();
  const state = useAppState((s) => s);
  const meId = state.sessionUserId ?? "";
  const user = state.users.find((u) => u.username === username);
  const [list, setList] = useState<"seguidores" | "seguindo" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [tab, setTab] = useState<"galeria" | "arquivados">("galeria");

  if (!user) {
    return (
      <div className="px-6 py-20 text-center">
        <h1 className="text-4xl">Perfil não encontrado</h1>
        <Button asChild variant="spray" className="mt-6">
          <Link to="/explorar">Explorar artistas</Link>
        </Button>
      </div>
    );
  }

  const isMe = user.id === meId;
  const iBlocked = (state.blocks[meId] ?? []).includes(user.id);
  const blocked = isBlockedBetween(state, meId, user.id);
  const posts = blocked ? [] : visiblePosts(state, meId).filter((p) => p.authorId === user.id);
  const pinned = posts.find((p) => p.id === user.pinnedPostId);
  const accent = { spray: "border-primary", violet: "border-secondary", lime: "border-accent", sand: "border-foreground" }[user.color];
  const followers = state.users.filter((u) => (state.follows[u.id] ?? []).includes(user.id));
  const following = state.users.filter((u) => (state.follows[user.id] ?? []).includes(u.id));
  const likes = posts.reduce((n, p) => n + p.likes.length, 0);
  const archived = isMe ? archivedPosts(state, meId) : [];
  const showing = isMe && tab === "arquivados" ? archived : posts;

  return (
    <div className="pb-10">
      <section className="px-4 pt-6 sm:px-0">
        {!blocked && <div className={cn("mb-5 h-32 overflow-hidden border-b-8 bg-muted sm:h-44", accent)}>{user.cover && <MediaImage src={user.cover} alt={`Capa de ${user.name}`} width={1200} height={400} priority className="size-full object-cover" />}</div>}
        <div className="flex items-center gap-5">
          <UserAvatar user={user} size="xl" className={cn("border-4", accent)} />
          <div className="grid flex-1 grid-cols-3 text-center">
            <Stat n={posts.length} label="obras" />
            <button onClick={() => setList("seguidores")} className="hover:text-primary">
              <Stat n={followers.length} label="seguidores" />
            </button>
            <button onClick={() => setList("seguindo")} className="hover:text-primary">
              <Stat n={following.length} label="seguindo" />
            </button>
          </div>
        </div>
        <div className="mt-4">
          <h1 className="text-3xl">{user.name}</h1>
          <p className="text-sm text-muted-foreground">
            @{user.username}
            {user.isModerator && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs font-bold text-accent-foreground">moderação</span>}
          </p>
          {user.bio && <p className="mt-2 max-w-prose whitespace-pre-line text-sm"><MentionText text={user.bio} /></p>}
          {user.showBairro && user.bairro && (
            <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-4" /> {user.bairro}
            </p>
          )}
          {user.styles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {user.styles.map((s) => (
                <Link key={s} to="/explorar" search={{ cat: s }} className="tape text-xs">
                  {s}
                </Link>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">{likes} curtidas recebidas</p>
        </div>

        <div className="mt-4 flex gap-2">
          {isMe ? (
            <>
              <Button asChild variant="following" className="flex-1">
                <Link to="/editar-perfil">Editar perfil</Link>
              </Button>
              <Button asChild variant="following" size="icon" aria-label="Configurações">
                <Link to="/configuracoes">
                  <Settings />
                </Link>
              </Button>
            </>
          ) : iBlocked ? (
            <Button variant="following" className="flex-1" onClick={() => actions.toggleBlock(user.id)}>
              Desbloquear
            </Button>
          ) : (
            <>
              <div className="flex-1 [&>button]:w-full">
                <FollowButton targetId={user.id} size="default" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="following" size="icon" aria-label="Mais opções">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setReportOpen(true)}>
                    <Flag /> Denunciar perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setBlockOpen(true)}>
                    <ShieldOff /> Bloquear
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </section>

      {pinned && <section className="mt-6 px-4 sm:px-0"><h2 className="mb-3 flex items-center gap-2 text-lg"><Pin className="size-4 text-accent" />Obra em destaque</h2><Link to="/post/$id" params={{ id: pinned.id }} className="flex items-center gap-4 border-y border-border py-3"><MediaImage {...postCover(pinned)} className="size-20 rounded-md object-cover" /><span className="min-w-0"><span className="block break-words font-bold">{pinned.title}</span><span className="text-sm text-muted-foreground">{pinned.likes.length} curtidas · {pinned.category}</span></span></Link></section>}
      {isMe ? (
        <div role="tablist" className="mt-6 flex border-t border-border text-sm font-bold uppercase tracking-wider">
          {(["galeria", "arquivados"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("flex flex-1 items-center justify-center gap-2 py-3 text-muted-foreground", tab === t && "border-t-2 border-primary text-foreground")}
            >
              {t === "galeria" ? <Grid3x3 className="size-4" /> : <Archive className="size-4" />}
              {t === "galeria" ? "Galeria" : `Arquivados (${archived.length})`}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 flex items-center justify-center gap-2 border-t border-border py-3 text-sm font-bold uppercase tracking-wider">
          <Grid3x3 className="size-4" /> Galeria
        </div>
      )}
      {blocked ? (
        <p className="px-6 py-12 text-center text-muted-foreground">Você não pode ver as obras deste perfil.</p>
      ) : showing.length ? (
        <PostGrid posts={showing} />
      ) : isMe && tab === "arquivados" ? (
        <p className="px-6 py-12 text-center text-muted-foreground">Nada arquivado. No ⋯ de uma publicação sua, toque em Arquivar para guardá-la só para você.</p>
      ) : (
        <div className="px-6 py-12 text-center">
          <p className="font-marker text-xl text-accent">Galeria em branco</p>
          {isMe && (
            <Button asChild variant="spray" className="mt-4">
              <Link to="/publicar">Publicar primeira obra</Link>
            </Button>
          )}
        </div>
      )}

      <Dialog open={list !== null} onOpenChange={(o) => !o && setList(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl uppercase">{list === "seguidores" ? "Seguidores" : "Seguindo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2" onClick={(e) => (e.target as HTMLElement).closest("a") && setList(null)}>
            {(list === "seguidores" ? followers : following).map((u) => (
              <ArtistCard key={u.id} user={u} />
            ))}
            {(list === "seguidores" ? followers : following).length === 0 && <p className="text-sm text-muted-foreground">Ninguém por aqui ainda.</p>}
          </div>
        </DialogContent>
      </Dialog>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="user" targetId={user.id} label="perfil" />
      <ConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title={`Bloquear @${user.username}?`}
        description="Vocês deixarão de se seguir e não verão as publicações um do outro."
        confirmLabel="Bloquear"
        destructive
        onConfirm={() => {
          actions.toggleBlock(user.id);
          toast.success("Perfil bloqueado");
          navigate({ to: "/feed" });
        }}
      />
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span className="block">
      <span className="block font-display text-2xl">{n}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}
