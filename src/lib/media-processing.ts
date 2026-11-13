import { cropRect, type CropAspect } from "./logic";

/** Ferramentas do navegador para preparar fotos e vídeos antes de publicar. */

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
    img.src = url;
  });
}

export function probeVideo(url: string): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      v.ondurationchange = null;
      v.removeAttribute("src");
      v.load();
      fn();
    };
    const fail = () => finish(() => reject(new Error("Não foi possível ler esse vídeo. Prefira MP4 (H.264).")));
    const timer = window.setTimeout(fail, 5000);
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      const ok = () => {
        const meta = { width: v.videoWidth, height: v.videoHeight, duration: v.duration };
        finish(() => resolve(meta));
      };
      if (Number.isFinite(v.duration)) return ok();
      // Vídeos gravados no navegador (WebM) às vezes chegam sem duração: pular para o fim força o cálculo.
      v.ondurationchange = () => {
        if (Number.isFinite(v.duration)) ok();
      };
      v.currentTime = Number.MAX_SAFE_INTEGER;
    };
    v.onerror = fail;
    v.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (webp) => {
        // Usa WebP quando o navegador suporta; senão, JPEG como alternativa.
        if (webp && webp.type === "image/webp") return resolve(webp);
        canvas.toBlob((jpg) => (jpg ? resolve(jpg) : reject(new Error("Falha ao gerar imagem."))), "image/jpeg", quality);
      },
      "image/webp",
      quality,
    );
  });
}

function draw(source: CanvasImageSource, sw: number, sh: number, aspect: CropAspect, pos: number, max: number) {
  const r = cropRect(sw, sh, aspect, pos);
  const scale = Math.min(1, max / Math.max(r.width, r.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(r.width * scale);
  canvas.height = Math.round(r.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não suporta edição de imagem.");
  ctx.drawImage(source, r.x, r.y, r.width, r.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Recorta e reduz a foto (máx. 1080 px) em WebP/JPEG. */
export async function renderImage(url: string, aspect: CropAspect, pos: number, max = 1080) {
  const img = await loadImage(url);
  const canvas = draw(img, img.naturalWidth, img.naturalHeight, aspect, pos, max);
  return { blob: await canvasToBlob(canvas, 0.82), width: canvas.width, height: canvas.height };
}

/** Captura um quadro do vídeo para usar como capa estática. */
export function captureVideoFrame(url: string, time: number, max = 720): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(Math.max(0, time), Math.max(0, v.duration - 0.1));
    };
    v.onseeked = () => {
      try {
        const canvas = draw(v, v.videoWidth, v.videoHeight, "original", 0.5, max);
        canvasToBlob(canvas, 0.8).then(resolve, reject);
      } catch (e) {
        reject(e as Error);
      }
    };
    v.onerror = () => reject(new Error("Não foi possível gerar a capa do vídeo."));
    v.src = url;
  });
}
