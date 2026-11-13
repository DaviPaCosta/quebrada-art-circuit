import { MAX_VIDEO_SECONDS } from "./logic";

/** Toque mais curto que isso = foto; segurar mais = vídeo. */
export const PHOTO_PRESS_MS = 300;
const MAX_RECORD_MS = MAX_VIDEO_SECONDS * 1000;

export function pressAction(pressMs: number): "foto" | "video" {
  return pressMs < PHOTO_PRESS_MS ? "foto" : "video";
}

/** Fração do anel de gravação (0 a 1). */
export function recordProgress(elapsedMs: number): number {
  return Math.min(1, Math.max(0, elapsedMs / MAX_RECORD_MS));
}

/** Para meio segundo antes do limite: o arquivo final nunca passa de 60 s. */
const STOP_AT_MS = MAX_RECORD_MS - 500;
export function shouldStopRecording(elapsedMs: number): boolean {
  return elapsedMs >= STOP_AT_MS;
}

/** Vídeo com menos de 1 s é descartado (vira foto). */
export const MIN_CLIP_MS = 1000;
export function clipTooShort(elapsedMs: number): boolean {
  return elapsedMs < MIN_CLIP_MS;
}

const RECORDER_MIMES = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

export function pickRecorderMime(isSupported: (type: string) => boolean): string | undefined {
  return RECORDER_MIMES.find((t) => isSupported(t));
}

/** Escala da pinça: distância atual / inicial, entre min e max. */
export function pinchScale(startDistance: number, currentDistance: number, min = 1, max = 4): number {
  if (startDistance <= 0) return min;
  return Math.min(max, Math.max(min, currentDistance / startDistance));
}
