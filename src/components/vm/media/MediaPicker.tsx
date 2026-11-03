import { Film, ImagePlus, Loader2, Plus } from "lucide-react";
import { useId } from "react";
import { MAX_MEDIA, MAX_VIDEO_SECONDS } from "@/lib/logic";
import { cn } from "@/lib/utils";

const ACCEPT = "image/*,video/mp4,video/webm,video/quicktime";

/** Escolher fotos e vídeos (toque ou arrastar). */
export function MediaPicker({
  onFiles,
  remaining,
  loading,
  compact = false,
}: {
  onFiles: (files: File[]) => void;
  remaining: number;
  loading: boolean;
  compact?: boolean;
}) {
  const id = useId();
  const input = (
    <input
      id={id}
      type="file"
      accept={ACCEPT}
      multiple
      className="sr-only"
      disabled={remaining <= 0 || loading}
      onChange={(e) => {
        onFiles(Array.from(e.target.files ?? []));
        e.target.value = "";
      }}
    />
  );

  if (compact) {
    return (
      <label
        htmlFor={id}
        aria-label="Adicionar mais fotos ou vídeos"
        className={cn(
          "flex size-16 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary",
          (remaining <= 0 || loading) && "pointer-events-none opacity-40",
        )}
      >
        {input}
        {loading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-6" />}
      </label>
    );
  }

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFiles(Array.from(e.dataTransfer.files ?? []));
      }}
      className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-card px-6 text-center hover:border-primary"
    >
      {input}
      {loading ? (
        <Loader2 className="size-12 animate-spin text-primary" />
      ) : (
        <span className="flex gap-2 text-primary">
          <ImagePlus className="size-12" />
          <Film className="size-12" />
        </span>
      )}
      <span className="font-display text-2xl uppercase">Escolher fotos ou vídeos</span>
      <span className="text-sm text-muted-foreground">
        Toque para escolher ou arraste aqui. Até {MAX_MEDIA} itens para montar um carrossel. Vídeos de até{" "}
        {MAX_VIDEO_SECONDS} segundos (MP4 de preferência).
      </span>
    </label>
  );
}
