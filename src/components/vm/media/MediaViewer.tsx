import { ChevronLeft, ChevronRight } from "lucide-react";
import { memo, useCallback, useRef, useState } from "react";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MediaImage } from "./MediaImage";
import { VideoPlayer } from "./VideoPlayer";

/** Proporção exibida: entre 4:5 (vertical) e 1,91:1 (horizontal), como no Instagram. */
function frameRatio(m: MediaItem, detail: boolean) {
  const r = m.width / m.height;
  const min = detail && m.kind === "video" ? 9 / 16 : 4 / 5;
  return Math.min(1.91, Math.max(min, r));
}

function Slide({ m, priority, detail }: { m: MediaItem; priority: boolean; detail: boolean }) {
  if (m.kind === "video") {
    return <VideoPlayer src={m.src} poster={m.poster} alt={m.alt} width={m.width} height={m.height} className="size-full" large={detail} />;
  }
  return (
    <MediaImage
      src={m.src}
      alt={m.alt}
      width={m.width}
      height={m.height}
      priority={priority}
      className={cn("size-full", detail ? "object-contain" : "object-cover")}
    />
  );
}

/** Mostra a mídia da publicação: foto, vídeo ou carrossel. */
export const MediaViewer = memo(function MediaViewer({
  media,
  detail = false,
  priority = false,
}: {
  media: MediaItem[];
  detail?: boolean;
  priority?: boolean;
}) {
  const first = media[0];
  if (!first) return null;
  const ratio = frameRatio(first, detail);
  if (media.length === 1) {
    return (
      <div className="relative w-full" style={{ aspectRatio: ratio, maxHeight: detail ? "80vh" : undefined }}>
        <Slide m={first} priority={priority} detail={detail} />
      </div>
    );
  }
  return <ImageCarousel media={media} ratio={ratio} detail={detail} priority={priority} />;
});

export function ImageCarousel({
  media,
  ratio,
  detail,
  priority,
}: {
  media: MediaItem[];
  ratio: number;
  detail: boolean;
  priority: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const frame = useRef(0);

  const onScroll = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = track.current;
      if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
    });
  }, []);

  const go = (i: number, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(media.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="relative w-full" role="region" aria-roledescription="carrossel" aria-label={`Carrossel com ${media.length} itens`}>
      <div
        ref={track}
        onScroll={onScroll}
        className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        style={{ aspectRatio: ratio, maxHeight: detail ? "80vh" : undefined }}
      >
        {media.map((m, i) => (
          <div
            key={m.id}
            className="relative h-full w-full shrink-0 snap-center"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${media.length}`}
          >
            <Slide m={m} priority={priority && i === 0} detail={detail} />
          </div>
        ))}
      </div>

      <span className="absolute right-3 top-3 rounded-full bg-background/75 px-2 py-0.5 text-xs font-bold backdrop-blur-sm">
        {index + 1}/{media.length}
      </span>
      {index > 0 && (
        <button
          type="button"
          onClick={(e) => go(index - 1, e)}
          aria-label="Item anterior"
          className="absolute left-2 top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 sm:flex"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {index < media.length - 1 && (
        <button
          type="button"
          onClick={(e) => go(index + 1, e)}
          aria-label="Próximo item"
          className="absolute right-2 top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 sm:flex"
        >
          <ChevronRight className="size-5" />
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5" aria-hidden>
        {media.map((m, i) => (
          <span key={m.id} className={cn("size-1.5 rounded-full bg-background/60 transition-transform", i === index && "scale-125 bg-primary")} />
        ))}
      </div>
    </div>
  );
}
