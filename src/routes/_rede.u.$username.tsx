import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Flag, Grid3x3, MapPin, MoreHorizontal, Settings, ShieldOff } from "lucide-react";
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
import { isBlockedBetween, visiblePosts } from "@/lib/logic";
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
  const meId = state.sessionUserId!;
  const user = state.users.find((u) => u.username === username);
  const [list, setList] = useState<"seguidores" | "seguindo" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

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
  const followers = state.users.filter((u) => (state.follows[u.id] ?? []).includes(user.id));
  const following = state.users.filter((u) => (state.follows[user.id] ?? []).includes(u.id));
  const likes = posts.reduce((n, p) => n + p.likes.length, 0);

  return (
    <div className="pb-10">
      <section className="px-4 pt-6 sm:px-0">
        <div className="flex items-center gap-5">
          <UserAvatar user={user} size="xl" className="ring-4 ring-primary" />
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
            {user.role === "moderador" && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs font-bold text-accent-foreground">moderação</span>}
          </p>
          {user.bio && <p className="mt-2 max-w-prose whitespace-pre-line text-sm">{user.bio}</p>}
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

      <div className="mt-6 flex items-center justify-center gap-2 border-t border-border py-3 text-sm font-bold uppercase tracking-wider">
        <Grid3x3 className="size-4" /> Galeria
      </div>
      {blocked ? (
        <p className="px-6 py-12 text-center text-muted-foreground">Você não pode ver as obras deste perfil.</p>
      ) : posts.length ? (
        <PostGrid posts={posts} />
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
