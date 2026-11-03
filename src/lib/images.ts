/**
 * Mídias de demonstração ficam em src/assets/seed em vários tamanhos:
 *  - nome.jpg (fallback) + nome-320/640/1024.webp (versões otimizadas)
 *  - nome.mp4 (vídeo H.264) + nome-poster.webp (capa)
 * Nas publicações elas aparecem como "seed:nome" para sobreviver a novas versões do app.
 */
const files = import.meta.glob("/src/assets/seed/*", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const file = (name: string) => files[`/src/assets/seed/${name}`];
const WIDTHS = [320, 640, 1024];

export interface ResolvedSource {
  src: string;
  /** srcset em WebP, quando houver versões por tamanho. */
  webpSrcSet?: string | undefined;
}

export function resolveSeed(name: string): ResolvedSource | undefined {
  const jpg = file(`${name}.jpg`);
  if (jpg) {
    const set = WIDTHS.map((w) => {
      const url = file(`${name}-${w}.webp`);
      return url ? `${url} ${w}w` : null;
    }).filter(Boolean);
    return { src: jpg, webpSrcSet: set.length ? set.join(", ") : undefined };
  }
  const other = file(`${name}.mp4`) ?? file(`${name}.webp`);
  return other ? { src: other } : undefined;
}

/** Resolve imagens síncronas (seed, data URL ou link). "idb:" precisa de useMediaSrc. */
export function resolveImage(src: string | undefined): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("seed:")) return resolveSeed(src.slice(5))?.src;
  if (src.startsWith("idb:")) return undefined;
  return src;
}

/** Reduz a imagem enviada para caber no armazenamento do aparelho (usado na foto de perfil). */
export function fileToResizedDataUrl(file: File, max = 1080, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Seu navegador não suporta edição de imagem."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
