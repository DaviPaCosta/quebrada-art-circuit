import mural from "@/assets/post-mural.jpg";
import letras from "@/assets/post-letras.jpg";
import lambe from "@/assets/post-lambe.jpg";
import poesia from "@/assets/post-poesia.jpg";
import danca from "@/assets/post-danca.jpg";
import grafite from "@/assets/post-grafite.jpg";
import rap from "@/assets/post-rap.jpg";
import foto from "@/assets/post-foto.jpg";

const SEED_IMAGES: Record<string, string> = {
  mural,
  letras,
  lambe,
  poesia,
  danca,
  grafite,
  rap,
  foto,
};

/** Imagens de exemplo são guardadas como "seed:nome" para sobreviver a novas versões do app. */
export function resolveImage(src: string | undefined): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("seed:")) return SEED_IMAGES[src.slice(5)];
  return src;
}

/** Reduz a imagem enviada para caber no armazenamento do aparelho. */
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
