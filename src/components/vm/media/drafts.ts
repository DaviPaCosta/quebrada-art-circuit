import { MAX_IMAGE_MB, validateVideo, type CropAspect } from "@/lib/logic";
import { loadImage, probeVideo } from "@/lib/media-processing";
import type { MediaKind } from "@/lib/types";

/** Foto ou vídeo escolhido, ainda não publicado (fica só na memória da página). */
export interface Draft {
  id: string;
  kind: MediaKind;
  file: File;
  url: string;
  width: number;
  height: number;
  duration?: number | undefined;
  alt: string;
  aspect: CropAspect;
  pos: number;
  coverTime: number;
}

const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export async function fileToDraft(file: File): Promise<Draft> {
  const id = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) throw new Error(`"${file.name}" não é foto nem vídeo.`);
  if (isVideo && !VIDEO_TYPES.includes(file.type))
    throw new Error(`"${file.name}": use vídeos MP4, WebM ou MOV.`);
  if (isImage && file.size > MAX_IMAGE_MB * 1024 * 1024)
    throw new Error(`"${file.name}": fotos podem ter no máximo ${MAX_IMAGE_MB} MB.`);

  const url = URL.createObjectURL(file);
  try {
    if (isImage) {
      const img = await loadImage(url);
      return { id, kind: "image", file, url, width: img.naturalWidth, height: img.naturalHeight, alt: "", aspect: "4:5", pos: 0.5, coverTime: 0 };
    }
    const meta = await probeVideo(url);
    const err = validateVideo(meta.duration, file.size);
    if (err) throw new Error(`"${file.name}": ${err}`);
    return {
      id,
      kind: "video",
      file,
      url,
      width: meta.width || 540,
      height: meta.height || 960,
      duration: meta.duration,
      alt: "",
      aspect: "original",
      pos: 0.5,
      coverTime: Math.min(1, meta.duration / 2),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}
