import { Loader2, Pause, Play, RotateCw, Volume2, VolumeX } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { useMediaSrc } from "@/hooks/use-media-src";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Só um vídeo toca por vez no app inteiro. */
let activeVideo: HTMLVideoElement | null = null;
/** Som ligado/desligado vale para todos os vídeos da sessão. */
let sessionMuted = true;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

interface Props {
  src: string;
  poster?: string | undefined;
  alt: string;
  width: number;
  height: number;
  className?: string;
  /** Toca sozinho (sem som) quando aparece na tela e pausa ao sair. */
  autoPlayInView?: boolean;
  /** Mostra o botão de som maior (usado nos Reels). */
  large?: boolean;
}

export const VideoPlayer = memo(function VideoPlayer({
  src,
  poster,
  alt,
  width,
  height,
  className,
  autoPlayInView = true,
  large = false,
}: Props) {
  const video = useMediaSrc(src);
  const cover = useMediaSrc(poster);
  const ref = useRef<HTMLVideoElement>(null);
  const reduceMotionSetting = useAppState((s) => s.settings.reduceMotion);
  const [near, setNear] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [muted, setMuted] = useState(sessionMuted);
  const [failed, setFailed] = useState(false);
  const userPaused = useRef(false);

  const canAutoplay = autoPlayInView && !reduceMotionSetting && !prefersReducedMotion();

  // Pré-carrega só os metadados quando o vídeo está perto de aparecer.
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setNear(true), { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near, video.status]);

  // Toca quando ≥ 60% visível, pausa ao sair da tela.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        if (e.intersectionRatio >= 0.6) {
          if (canAutoplay && !userPaused.current) el.play().catch(() => {});
        } else {
          el.pause();
          if (e.intersectionRatio === 0) userPaused.current = false;
        }
      },
      { threshold: [0, 0.6] },
    );
    io.observe(el);
    const onHidden = () => document.hidden && el.pause();
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onHidden);
      el.pause();
      if (activeVideo === el) activeVideo = null;
    };
  }, [canAutoplay, video.status]);

  const onPlay = () => {
    const el = ref.current;
    if (activeVideo && activeVideo !== el) activeVideo.pause();
    activeVideo = el;
    setPlaying(true);
  };

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      userPaused.current = false;
      el.play().catch(() => {});
    } else {
      userPaused.current = true;
      el.pause();
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sessionMuted = !muted;
    setMuted(sessionMuted);
  };

  if (video.status === "error" || failed) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 bg-muted p-4 text-center text-xs text-muted-foreground", className)}>
        <span>Vídeo indisponível neste aparelho</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setFailed(false);
            video.retry();
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-semibold text-foreground hover:bg-background"
        >
          <RotateCw className="size-3" /> Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <video
        ref={ref}
        src={video.source?.src}
        poster={cover.source?.src}
        width={width}
        height={height}
        muted={muted}
        loop
        playsInline
        preload={near ? "metadata" : "none"}
        aria-label={alt}
        onPlay={onPlay}
        onPause={() => setPlaying(false)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onError={() => video.source && setFailed(true)}
        onClick={toggle}
        className="size-full cursor-pointer object-cover"
      />
      {!playing && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Reproduzir vídeo"
          className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background/70 text-foreground backdrop-blur-sm"
        >
          <Play className="ml-1 size-8 fill-current" />
        </button>
      )}
      {playing && waiting && (
        <Loader2 aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 animate-spin text-foreground" />
      )}
      <div className="absolute bottom-3 right-3 flex gap-2">
        {playing && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Pausar vídeo"
            className={cn("flex items-center justify-center rounded-full bg-background/70 backdrop-blur-sm", large ? "size-11" : "size-9")}
          >
            <Pause className="size-4 fill-current" />
          </button>
        )}
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Ativar som" : "Desativar som"}
          aria-pressed={!muted}
          className={cn("flex items-center justify-center rounded-full bg-background/70 backdrop-blur-sm", large ? "size-11" : "size-9")}
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>
    </div>
  );
});
