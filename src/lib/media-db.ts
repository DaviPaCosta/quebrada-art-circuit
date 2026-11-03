/**
 * Guarda fotos e vídeos enviados no próprio navegador (IndexedDB), sem servidor.
 * O localStorage é pequeno demais para vídeos; aqui ficam só os arquivos,
 * e a publicação guarda a referência "idb:chave".
 */
const DB_NAME = "vozes-do-muro-midias";
const STORE = "midias";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Armazenamento indisponível."));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error("Não foi possível abrir o armazenamento."));
      };
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
        tx.onerror = () => reject(tx.error ?? new Error("Falha no armazenamento."));
        tx.onabort = () =>
          reject(
            tx.error?.name === "QuotaExceededError"
              ? new Error("Armazenamento do aparelho cheio. Exclua publicações antigas.")
              : (tx.error ?? new Error("Operação cancelada.")),
          );
      }),
  );
}

export async function putMedia(blob: Blob): Promise<string> {
  const key = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await run("readwrite", (s) => s.put(blob, key));
  return `idb:${key}`;
}

export function getMediaBlob(ref: string): Promise<Blob | undefined> {
  return run<Blob | undefined>("readonly", (s) => s.get(ref.replace(/^idb:/, "")) as IDBRequest<Blob | undefined>);
}

const urlCache = new Map<string, Promise<string>>();

/** Gera (uma única vez por sessão) um endereço local para a mídia guardada. */
export function getMediaUrl(ref: string): Promise<string> {
  let p = urlCache.get(ref);
  if (!p) {
    p = getMediaBlob(ref).then((blob) => {
      if (!blob) throw new Error("Mídia não encontrada neste aparelho.");
      return URL.createObjectURL(blob);
    });
    p.catch(() => urlCache.delete(ref));
    urlCache.set(ref, p);
  }
  return p;
}

export async function deleteMedia(refs: string[]) {
  const keys = refs.filter((r) => r.startsWith("idb:"));
  if (!keys.length) return;
  for (const ref of keys) {
    const cached = urlCache.get(ref);
    urlCache.delete(ref);
    cached?.then((u) => URL.revokeObjectURL(u)).catch(() => {});
  }
  await run("readwrite", (s) => {
    keys.forEach((k) => s.delete(k.replace(/^idb:/, "")));
  }).catch(() => {});
}

export async function clearMedia() {
  urlCache.forEach((p) => p.then((u) => URL.revokeObjectURL(u)).catch(() => {}));
  urlCache.clear();
  await run("readwrite", (s) => s.clear()).catch(() => {});
}
