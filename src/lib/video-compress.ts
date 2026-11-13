/**
 * Comprime vídeo no próprio aparelho: toca o vídeo num <canvas> menor (480p) e regrava com MediaRecorder.
 * Leva mais ou menos o tempo do próprio vídeo. Só funciona no navegador (testado manualmente).
 */

const TARGET_SHORT_SIDE = 480;
const VIDEO_BPS = 1_000_000;
const AUDIO_BPS = 96_000;

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

export function canCompressVideo(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const canvas = document.createElement("canvas") as HTMLCanvasElement & { captureStream?: unknown };
  return typeof canvas.captureStream === "function" && Boolean(pickMime());
}

/** Tamanho de saída com o lado menor em até 480 px e medidas pares (exigência dos codecs). */
export function outputSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, TARGET_SHORT_SIDE / Math.min(width, height));
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { width: even(width), height: even(height) };
}

type VideoWithFrames = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
};

export async function compressVideo(file: File | Blob, onProgress: (ratio: number) => void): Promise<Blob> {
  const mime = pickMime();
  if (!mime) throw new Error("Este aparelho não consegue preparar vídeos.");

  const url = URL.createObjectURL(file);
  const video = document.createElement("video") as VideoWithFrames;
  video.src = url;
  video.playsInline = true;
  video.preload = "auto";

  let audioCtx: AudioContext | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Não foi possível ler o vídeo."));
    });

    const { width, height } = outputSize(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Este aparelho não consegue preparar vídeos.");

    const stream = (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(30);

    // Áudio: passa pelo AudioContext para ser gravado sem tocar no alto-falante.
    try {
      audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch {
      video.muted = true; // sem áudio, mas o vídeo continua
    }

    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO_BPS, audioBitsPerSecond: AUDIO_BPS });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);

    const finished = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(";")[0] ?? mime }));
      recorder.onerror = () => reject(new Error("Não foi possível preparar o vídeo."));
    });

    let done = false;
    const draw = () => {
      if (done) return;
      ctx.drawImage(video, 0, 0, width, height);
      if (video.duration > 0) onProgress(Math.min(1, video.currentTime / video.duration));
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(draw);
      else requestAnimationFrame(draw);
    };

    const ended = new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("O vídeo demorou demais para ficar pronto.")), (video.duration * 2 + 15) * 1000),
    );

    recorder.start(1000);
    await audioCtx?.resume().catch(() => {});
    try {
      await video.play();
    } catch {
      video.muted = true;
      await video.play();
    }
    draw();
    await Promise.race([ended, timeout]);
    done = true;
    recorder.stop();
    const blob = await finished;
    onProgress(1);
    return blob;
  } finally {
    video.pause();
    URL.revokeObjectURL(url);
    void audioCtx?.close().catch(() => {});
  }
}
