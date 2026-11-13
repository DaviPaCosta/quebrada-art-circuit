import { getSupabase } from "../supabase";

export const MEDIA_BUCKET = "media";
const UPLOAD_ERROR = "Não conseguimos enviar sua foto/vídeo. Tente de novo.";

export type Uploaded = { url: string; path: string };

const CONTENT_TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webm: "video/webm",
  mp4: "video/mp4",
};

/** Extensão a partir do tipo do arquivo (ex.: "video/webm;codecs=vp9" → "webm"). */
export function extFor(blob: Blob, fallback = "webp"): string {
  const sub = blob.type.split(";")[0]?.split("/")[1];
  return sub && CONTENT_TYPES[sub] ? sub : fallback;
}

/** Envia um arquivo para a pasta da pessoa logada e devolve o endereço público. */
export async function uploadMedia(blob: Blob, ext: string): Promise<Uploaded> {
  const db = getSupabase();
  const { data } = await db.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error("Entre na sua conta.");
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, { contentType: CONTENT_TYPES[ext] ?? blob.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(UPLOAD_ERROR);
  return { url: db.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl, path };
}

export async function removeUploads(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await getSupabase().storage.from(MEDIA_BUCKET).remove(paths);
}

/** Caminho dentro do bucket a partir do endereço público (para apagar depois). */
export function pathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

/** Envia todos em ordem; se um falhar, apaga os que já subiram e lança um erro amigável. */
export async function uploadAll(
  items: { blob: Blob; ext: string }[],
  uploader: (blob: Blob, ext: string) => Promise<Uploaded> = uploadMedia,
  remover: (paths: string[]) => Promise<void> = removeUploads,
): Promise<Uploaded[]> {
  const done: Uploaded[] = [];
  try {
    for (const item of items) done.push(await uploader(item.blob, item.ext));
    return done;
  } catch {
    await remover(done.map((d) => d.path)).catch(() => {});
    throw new Error(UPLOAD_ERROR);
  }
}

/** Envia uma imagem já reduzida (data URL) e devolve o endereço público. */
export async function uploadDataUrl(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  return (await uploadMedia(blob, extFor(blob, "webp"))).url;
}
