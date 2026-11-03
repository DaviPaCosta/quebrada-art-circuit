import { ImageOff, RotateCw } from "lucide-react";
import { memo, useState } from "react";
import { useMediaSrc } from "@/hooks/use-media-src";
import { cn } from "@/lib/utils";

interface Props {
  src: string | undefined;
  alt: string;
  width: number;
  height: number;
  /** Tamanho exibido, para o navegador escolher a versão certa (320/640/1024 px). */
  sizes?: string;
  /** Imagem principal visível: carrega primeiro, sem lazy loading. */
  priority?: boolean;
  className?: string;
}

/** Foto otimizada: WebP por tamanho com fallback JPEG, dimensões fixas e carregamento progressivo. */
export const MediaImage = memo(function MediaImage({
  src,
  alt,
  width,
  height,
  sizes = "(min-width: 640px) 576px, 100vw",
  priority = false,
  className,
}: Props) {
  const media = useMediaSrc(src);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (media.status === "error" || failed) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 bg-muted p-4 text-center text-xs text-muted-foreground", className)}>
        <ImageOff className="size-6" aria-hidden />
        <span>Imagem indisponível neste aparelho</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setFailed(false);
            media.retry();
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-semibold text-foreground hover:bg-background"
        >
          <RotateCw className="size-3" /> Tentar de novo
        </button>
      </div>
    );
  }

  if (media.status === "loading") {
    return <div className={cn("animate-pulse bg-muted", className)} aria-busy="true" aria-label="Carregando imagem" />;
  }

  return (
    <picture className="contents">
      {media.source.webpSrcSet && <source type="image/webp" srcSet={media.source.webpSrcSet} sizes={sizes} />}
      <img
        src={media.source.src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn("bg-muted transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0", className)}
      />
    </picture>
  );
});
