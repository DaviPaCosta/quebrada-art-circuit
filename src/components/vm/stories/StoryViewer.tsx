import { Link } from "@tanstack/react-router";
import { Eye, Flag, Flame, Pause, Play, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/vm/ConfirmDialog";
import { ReportDialog } from "@/components/vm/ReportDialog";
import { UserAvatar } from "@/components/vm/UserAvatar";
import { MediaImage } from "@/components/vm/media/MediaImage";
import { useMediaSrc } from "@/hooks/use-media-src";
import { format } from "@/lib/format-story";
import { STORY_IMAGE_SECONDS, type StoryGroup } from "@/lib/logic";
import { actions, useAppState } from "@/lib/store";
import type { Story } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  groups: StoryGroup[];
  startIndex: number;
  onClose: () => void;
}

/** Tela cheia dos stories: barras de progresso, toque para avançar e segurar para pausar. */
export function StoryViewer({ groups: initialGroups, startIndex, onClose }: Props) {
  // A ordem fica fixa enquanto a tela está aberta (marcar como visto não reorganiza nada).
  const [groups] = useState(initialGroups);
  const [gi, setGi] = useState(startIndex);
  const [si, setSi] = useState(() => {
    const g = initialGroups[startIndex];
    const firstUnseen = g?.stories.findIndex((st) => !st.viewers.includes(g.user.id)) ?? 0;
    return Math.max(0, firstUnseen);
  });
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  const [dialogOpen, setDialogOpen] = useState<"delete" | "report" | "viewers" | null>(null);
  const [muted, setMuted] = useState(true);

  const meId = useAppState((s) => s.sessionUserId);
  const group = groups[gi];
  const baseStory = group?.stories[si];
  // Versão "ao vivo" do story (visualizações, reações, exclusão).
  const live = useAppState((s) => (baseStory ? s.stories.find((x) => x.id === baseStory.id) : undefined));
  const users = useAppState((s) => s.users);
  const story: Story | undefined = live ?? baseStory;
  const mine = story?.authorId === meId;
  const paused = held || dialogOpen !== null;

  const next = useCallback(() => {
    setProgress(0);
    if (!group) return onClose();
    if (si < group.stories.length - 1) return setSi(si + 1);
    if (gi < groups.length - 1) {
      setGi(gi + 1);
      setSi(0);
      return;
    }
    onClose();
  }, [group, si, gi, groups.length, onClose]);

  const prev = useCallback(() => {
    setProgress(0);
    if (si > 0) return setSi(si - 1);
    if (gi > 0) {
      const g = groups[gi - 1]!;
      setGi(gi - 1);
      setSi(g.stories.length - 1);
    }
  }, [si, gi, groups]);

  // Marca como visto.
  useEffect(() => {
    if (story && !mine) actions.markStoryViewed(story.id);
  }, [story?.id, mine]); // eslint-disable-line react-hooks/exhaustive-deps

  // Story apagado enquanto aberto: pula para o próximo.
  useEffect(() => {
    if (baseStory && !live) next();
  }, [baseStory, live, next]);

  // Fotos: avançam sozinhas depois de alguns segundos.
  useEffect(() => {
    if (!story || story.media.kind !== "image" || paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      setProgress((p) => {
        const np = p + dt / (STORY_IMAGE_SECONDS * 1000);
        return np >= 1 ? 1 : np;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [story, paused]);

  useEffect(() => {
    if (progress >= 1) next();
  }, [progress, next]);

  // Teclado e rolagem da página.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialogOpen) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") {
        e.preventDefault();
        setHeld((h) => !h);
      }
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [next, prev, onClose, dialogOpen]);

  // Toque rápido = navegar; segurar = pausar.
  const pressStart = useRef(0);
  const onPointerDown = () => {
    pressStart.current = performance.now();
    setHeld(true);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setHeld(false);
    if (performance.now() - pressStart.current > 250) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 3) prev();
    else next();
  };

  if (!group || !story) return null;
  const reacted = !!meId && story.reactions.includes(meId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Stories de ${group.user.username}`}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background"
    >
      <div className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-card sm:my-4 sm:h-[calc(100%-2rem)] sm:rounded-xl">
        {/* Mídia */}
        <div
          className="absolute inset-0 flex touch-none select-none items-center justify-center"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setHeld(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {story.media.kind === "image" ? (
            <MediaImage
              key={story.id}
              src={story.media.src}
              alt={story.media.alt}
              width={story.media.width}
              height={story.media.height}
              sizes="448px"
              priority
              className="h-full w-full object-contain"
            />
          ) : (
            <StoryVideo
              key={story.id}
              story={story}
              paused={paused}
              muted={muted}
              onProgress={setProgress}
              onEnded={next}
            />
          )}
        </div>

        {/* Topo */}
        <div className="pointer-events-none relative z-10 bg-gradient-to-b from-background/80 to-transparent px-3 pb-8 pt-3">
          <div className="flex gap-1" aria-hidden>
            {group.stories.map((st, i) => (
              <span key={st.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-foreground/30">
                <span
                  className="block h-full bg-foreground"
                  style={{ width: `${(i < si ? 1 : i === si ? progress : 0) * 100}%` }}
                />
              </span>
            ))}
          </div>
          <div className="pointer-events-auto mt-3 flex items-center gap-2">
            <Link
              to="/u/$username"
              params={{ username: group.user.username }}
              onClick={onClose}
              className="flex min-w-0 items-center gap-2"
            >
              <UserAvatar user={group.user} size="sm" />
              <span className="truncate text-sm font-bold">{group.user.username}</span>
            </Link>
            <span className="shrink-0 text-xs text-foreground/70">{format(story.createdAt)}</span>
            <div className="ml-auto flex items-center">
              <IconButton label={paused ? "Continuar" : "Pausar"} onClick={() => setHeld((h) => !h)}>
                {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
              </IconButton>
              {story.media.kind === "video" && (
                <IconButton label={muted ? "Ligar som" : "Desligar som"} onClick={() => setMuted((m) => !m)}>
                  {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                </IconButton>
              )}
              <IconButton label="Fechar stories" onClick={onClose}>
                <X className="size-6" />
              </IconButton>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="pointer-events-none relative z-10 mt-auto bg-gradient-to-t from-background/90 to-transparent px-4 pb-5 pt-16">
          {story.caption && (
            <p className="mb-4 font-marker text-xl leading-snug text-foreground [text-shadow:0_1px_6px_var(--background)]">
              {story.caption}
            </p>
          )}
          <div className="pointer-events-auto flex items-center gap-2">
            {mine ? (
              <>
                <button
                  type="button"
                  onClick={() => setDialogOpen("viewers")}
                  className="flex items-center gap-2 rounded-full bg-muted/80 px-4 py-2 text-sm font-semibold"
                >
                  <Eye className="size-4" /> Visto por {story.viewers.length}
                  {story.reactions.length > 0 && (
                    <span className="flex items-center gap-1 text-primary">
                      · <Flame className="size-4 fill-primary" /> {story.reactions.length}
                    </span>
                  )}
                </button>
                <IconButton label="Apagar story" onClick={() => setDialogOpen("delete")} className="ml-auto">
                  <Trash2 className="size-5" />
                </IconButton>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={reacted}
                  onClick={() => actions.reactToStory(story.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border border-foreground/40 px-4 py-2 text-sm font-semibold transition",
                    reacted ? "border-primary bg-primary text-primary-foreground" : "hover:bg-foreground/10",
                  )}
                >
                  <Flame className={cn("size-4", reacted && "fill-primary-foreground")} />
                  {reacted ? "Fogo enviado!" : "Mandar fogo"}
                </button>
                <IconButton label="Denunciar" onClick={() => setDialogOpen("report")} className="ml-auto">
                  <Flag className="size-5" />
                </IconButton>
              </>
            )}
          </div>
        </div>

        {/* Lista de quem viu */}
        {dialogOpen === "viewers" && (
          <div className="absolute inset-x-0 bottom-0 z-20 max-h-[60%] overflow-y-auto rounded-t-2xl border-t border-border bg-popover p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl uppercase">Quem viu</h2>
              <IconButton label="Fechar lista" onClick={() => setDialogOpen(null)}>
                <X className="size-5" />
              </IconButton>
            </div>
            {story.viewers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Ninguém viu ainda.</p>
            ) : (
              <ul className="space-y-3">
                {story.viewers.map((id) => {
                  const u = users.find((x) => x.id === id);
                  if (!u) return null;
                  return (
                    <li key={id} className="flex items-center gap-3">
                      <UserAvatar user={u} size="sm" />
                      <span className="flex-1 text-sm font-semibold">{u.username}</span>
                      {story.reactions.includes(id) && <Flame className="size-4 fill-primary text-primary" aria-label="mandou fogo" />}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={dialogOpen === "delete"}
        onOpenChange={(o) => setDialogOpen(o ? "delete" : null)}
        title="Apagar story?"
        description="Ele some na hora para todo mundo."
        confirmLabel="Apagar"
        destructive
        onConfirm={() => {
          setDialogOpen(null);
          actions.deleteStory(story.id);
        }}
      />
      <ReportDialog
        open={dialogOpen === "report"}
        onOpenChange={(o) => setDialogOpen(o ? "report" : null)}
        targetType="user"
        targetId={story.authorId}
        label={`o story de @${group.user.username}`}
      />
    </div>
  );
}

function IconButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("flex size-10 items-center justify-center rounded-full hover:bg-foreground/10", className)}
    >
      {children}
    </button>
  );
}

function StoryVideo({
  story,
  paused,
  muted,
  onProgress,
  onEnded,
}: {
  story: Story;
  paused: boolean;
  muted: boolean;
  onProgress: (p: number) => void;
  onEnded: () => void;
}) {
  const video = useMediaSrc(story.media.src);
  const cover = useMediaSrc(story.media.poster);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (paused) v.pause();
    else void v.play().catch(() => {});
  }, [paused, video.status]);

  if (video.status !== "ready") {
    return <div className="h-full w-full animate-pulse bg-muted" aria-busy="true" aria-label="Carregando vídeo" />;
  }
  return (
    <video
      ref={ref}
      src={video.source.src}
      poster={cover.status === "ready" ? cover.source.src : undefined}
      muted={muted}
      playsInline
      autoPlay
      aria-label={story.media.alt}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        if (v.duration) onProgress(Math.min(0.999, v.currentTime / v.duration));
      }}
      onEnded={onEnded}
      onError={onEnded}
      className="h-full w-full object-contain"
    />
  );
}
