import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MAX_IMAGE_MB } from "@/lib/logic";
import { extFor, uploadAll } from "@/lib/api/media";
import { prepareVideo } from "@/lib/prepare-media";
import { captureVideoFrame, probeVideo, renderImage } from "@/lib/media-processing";
import { actions } from "@/lib/store";
import type { MediaItem } from "@/lib/types";

/** Confirma a foto/vídeo escolhido, permite uma legenda curta e publica o story. */
export function StoryComposer({ file, onClose }: { file: File | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const isVideo = !!file?.type.startsWith("video/");

  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    setCaption("");
    return () => URL.revokeObjectURL(u);
  }, [file]);

  async function publish() {
    if (!file || !url) return;
    setBusy(true);
    try {
      let media: MediaItem;
      const id = `ms${Date.now().toString(36)}`;
      if (isVideo) {
        const meta = await probeVideo(url);
        const poster = await captureVideoFrame(url, 0.5);
        const video = await prepareVideo(file, meta.duration, (r) => setProgress(Math.round(r * 100)));
        const [src, posterUp] = await uploadAll([
          { blob: video, ext: extFor(video, "mp4") },
          { blob: poster, ext: extFor(poster, "webp") },
        ]);
        media = { id, kind: "video", src: src!.url, poster: posterUp!.url, width: meta.width, height: meta.height, duration: meta.duration, alt: caption || "Vídeo do story" };
      } else {
        if (file.size > MAX_IMAGE_MB * 1024 * 1024) throw new Error(`Fotos podem ter no máximo ${MAX_IMAGE_MB} MB.`);
        const out = await renderImage(url, "original", 0.5, 1080);
        const [src] = await uploadAll([{ blob: out.blob, ext: extFor(out.blob, "webp") }]);
        media = { id, kind: "image", src: src!.url, width: out.width, height: out.height, alt: caption || "Foto do story" };
      }
      const storyId = await actions.createStory(media, caption);
      if (storyId) {
        toast.success("Story no ar! Ele some em 24 horas.");
        onClose();
      }
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível publicar o story.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Novo story</DialogTitle>
          <DialogDescription>Fica no ar por 24 horas. Lembre de dar crédito a quem fez a obra.</DialogDescription>
        </DialogHeader>
        <div className="mx-auto aspect-[9/16] max-h-[50vh] w-full overflow-hidden rounded-lg bg-muted">
          {url &&
            (isVideo ? (
              <video src={url} muted autoPlay loop playsInline className="h-full w-full object-contain" />
            ) : (
              <img src={url} alt="Prévia do story" className="h-full w-full object-contain" />
            ))}
        </div>
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={120}
          placeholder="Escreva algo (opcional)"
          aria-label="Legenda do story"
        />
        <Button variant="spray" onClick={publish} disabled={busy || !url}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {busy ? (progress !== null && progress < 100 ? `Preparando vídeo… ${progress}%` : "Publicando...") : "Publicar story"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
