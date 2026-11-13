import { VIDEO_FALLBACK_MB, videoPlan } from "./logic";
import { canCompressVideo, compressVideo, type CompressOptions } from "./video-compress";

/** Decide e prepara o vídeo para envio: comprime quando o aparelho consegue; senão manda o original (se for pequeno). */
export async function prepareVideo(
  file: File,
  durationSec: number,
  onProgress: (ratio: number) => void,
  options: CompressOptions = {},
): Promise<Blob> {
  const plan = videoPlan({ canCompress: canCompressVideo() }, file.size, durationSec);
  if (plan.action === "recusar") throw new Error(plan.error);
  if (plan.action === "enviar") return file;
  try {
    return await compressVideo(file, onProgress, options);
  } catch {
    // Se a compressão falhar no meio, ainda dá para mandar o original pequeno.
    if (file.size <= VIDEO_FALLBACK_MB * 1e6) return file;
    throw new Error("Não foi possível preparar o vídeo. Tente um vídeo mais curto.");
  }
}

/** Cria o áudio dentro do toque no botão (exigência do iPhone para gravar o som do vídeo). */
export function unlockAudio(): AudioContext | undefined {
  try {
    const ctx = new AudioContext();
    void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return undefined;
  }
}

/** Avisa já na escolha do arquivo se o vídeo não vai poder ser enviado. */
export function videoProblem(file: File, durationSec: number): string | null {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return "Não foi possível ler a duração do vídeo.";
  const plan = videoPlan({ canCompress: canCompressVideo() }, file.size, durationSec);
  return plan.action === "recusar" ? plan.error : null;
}
