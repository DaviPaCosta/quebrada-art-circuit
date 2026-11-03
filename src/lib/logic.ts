import type { AppState, Category, MediaItem, Post, PostType, ReportTarget, User } from "./types";

export const uid = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const now = () => new Date().toISOString();

export function normalizeUsername(u: string) {
  return u.trim().replace(/^@/, "").toLowerCase();
}

export function isValidUsername(u: string) {
  return /^[a-z0-9._]{3,20}$/.test(u);
}

export type Result = { ok: true; state: AppState } | { ok: false; error: string };

export function signUp(
  s: AppState,
  input: { name: string; username: string; email: string; password: string },
): Result {
  const username = normalizeUsername(input.username);
  const email = input.email.trim().toLowerCase();
  if (!input.name.trim()) return { ok: false, error: "Informe seu nome de exibição." };
  if (!isValidUsername(username))
    return { ok: false, error: "Usuário deve ter 3 a 20 caracteres: letras, números, ponto ou _." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "E-mail inválido." };
  if (input.password.length < 6)
    return { ok: false, error: "A senha precisa ter pelo menos 6 caracteres." };
  if (s.users.some((u) => u.username === username))
    return { ok: false, error: "Esse nome de usuário já está em uso." };
  if (s.users.some((u) => u.email.toLowerCase() === email))
    return { ok: false, error: "Já existe uma conta com esse e-mail." };

  const colors: User["color"][] = ["spray", "violet", "lime", "sand"];
  const user: User = {
    id: uid("u"),
    username,
    name: input.name.trim(),
    email,
    password: input.password,
    color: colors[s.users.length % colors.length]!,
    bio: "",
    bairro: "",
    showBairro: false,
    styles: [],
    role: "usuario",
    createdAt: now(),
  };
  return { ok: true, state: { ...s, users: [...s.users, user], sessionUserId: user.id } };
}

export function signIn(s: AppState, identifier: string, password: string): Result {
  const id = identifier.trim().toLowerCase().replace(/^@/, "");
  const user = s.users.find((u) => u.email.toLowerCase() === id || u.username === id);
  if (!user || user.password !== password)
    return { ok: false, error: "E-mail/usuário ou senha incorretos." };
  return { ok: true, state: { ...s, sessionUserId: user.id } };
}

export function toggleLike(s: AppState, userId: string, postId: string): AppState {
  const post = s.posts.find((p) => p.id === postId);
  if (!post) return s;
  const liked = post.likes.includes(userId);
  const posts = s.posts.map((p) =>
    p.id === postId
      ? { ...p, likes: liked ? p.likes.filter((l) => l !== userId) : [...p.likes, userId] }
      : p,
  );
  let notifications = s.notifications;
  if (!liked && post.authorId !== userId) {
    notifications = [
      {
        id: uid("n"),
        userId: post.authorId,
        actorId: userId,
        type: "like",
        postId,
        createdAt: now(),
        read: false,
      },
      ...notifications,
    ];
  }
  return { ...s, posts, notifications };
}

export function addComment(s: AppState, userId: string, postId: string, text: string): AppState {
  const clean = text.trim();
  const post = s.posts.find((p) => p.id === postId);
  if (!clean || !post) return s;
  const comment = { id: uid("c"), postId, authorId: userId, text: clean.slice(0, 500), createdAt: now() };
  const notifications =
    post.authorId !== userId
      ? [
          {
            id: uid("n"),
            userId: post.authorId,
            actorId: userId,
            type: "comment" as const,
            postId,
            text: clean.slice(0, 80),
            createdAt: now(),
            read: false,
          },
          ...s.notifications,
        ]
      : s.notifications;
  return { ...s, comments: [...s.comments, comment], notifications };
}

function toggleIn(map: Record<string, string[]>, key: string, value: string) {
  const list = map[key] ?? [];
  return {
    ...map,
    [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
  };
}

export function toggleFollow(s: AppState, userId: string, targetId: string): AppState {
  if (userId === targetId) return s;
  const wasFollowing = (s.follows[userId] ?? []).includes(targetId);
  const follows = toggleIn(s.follows, userId, targetId);
  const notifications = wasFollowing
    ? s.notifications
    : [
        {
          id: uid("n"),
          userId: targetId,
          actorId: userId,
          type: "follow" as const,
          createdAt: now(),
          read: false,
        },
        ...s.notifications,
      ];
  return { ...s, follows, notifications };
}

export function toggleSave(s: AppState, userId: string, postId: string): AppState {
  return { ...s, saved: toggleIn(s.saved, userId, postId) };
}

export function toggleBlock(s: AppState, userId: string, targetId: string): AppState {
  if (userId === targetId) return s;
  const blocking = !(s.blocks[userId] ?? []).includes(targetId);
  let follows = s.follows;
  if (blocking) {
    // Bloquear desfaz o "seguir" nos dois sentidos.
    follows = {
      ...follows,
      [userId]: (follows[userId] ?? []).filter((id) => id !== targetId),
      [targetId]: (follows[targetId] ?? []).filter((id) => id !== userId),
    };
  }
  return { ...s, blocks: toggleIn(s.blocks, userId, targetId), follows };
}

export function isBlockedBetween(s: AppState, a: string, b: string) {
  return (s.blocks[a] ?? []).includes(b) || (s.blocks[b] ?? []).includes(a);
}

/** Publicações que um usuário pode ver: sem removidas e sem autores bloqueados. */
export function visiblePosts(s: AppState, viewerId: string | null): Post[] {
  return s.posts
    .filter((p) => !p.removed && (!viewerId || !isBlockedBetween(s, viewerId, p.authorId)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type NewPostData = {
  media: MediaItem[];
  title: string;
  description: string;
  category: Category;
  credits: string;
  tags: string[];
  region?: string | undefined;
};

export function createPost(s: AppState, userId: string, data: NewPostData): { state: AppState; id: string } {
  const id = uid("p");
  const media = data.media.slice(0, MAX_MEDIA);
  const post: Post = {
    id,
    authorId: userId,
    likes: [],
    createdAt: now(),
    ...data,
    media,
    type: postTypeFor(media),
  };
  return { id, state: { ...s, posts: [post, ...s.posts] } };
}

/* ---------- Fotos e vídeos ---------- */

export const MAX_MEDIA = 10;
export const MAX_VIDEO_SECONDS = 60;
export const MAX_VIDEO_MB = 50;
export const MAX_IMAGE_MB = 20;

export function postTypeFor(media: Pick<MediaItem, "kind">[]): PostType {
  if (media.length > 1) return "carrossel";
  return media[0]?.kind === "video" ? "video" : "imagem";
}

/** Regras do vídeo no protótipo: até 60 s e 50 MB. */
export function validateVideo(durationSec: number, sizeBytes: number): string | null {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return "Não foi possível ler a duração do vídeo.";
  if (durationSec > MAX_VIDEO_SECONDS) return `Vídeos podem ter no máximo ${MAX_VIDEO_SECONDS} segundos.`;
  if (sizeBytes > MAX_VIDEO_MB * 1024 * 1024) return `Vídeos podem ter no máximo ${MAX_VIDEO_MB} MB.`;
  return null;
}

export type CropAspect = "original" | "1:1" | "4:5" | "16:9";

export const CROP_RATIOS: Record<Exclude<CropAspect, "original">, number> = {
  "1:1": 1,
  "4:5": 4 / 5,
  "16:9": 16 / 9,
};

/** Área central recortada; `pos` (0 a 1) move o recorte no eixo que sobra. */
export function cropRect(w: number, h: number, aspect: CropAspect, pos = 0.5) {
  const p = Math.min(1, Math.max(0, pos));
  if (aspect === "original") return { x: 0, y: 0, width: w, height: h };
  const target = CROP_RATIOS[aspect];
  if (w / h > target) {
    const width = Math.round(h * target);
    return { x: Math.round((w - width) * p), y: 0, width, height: h };
  }
  const height = Math.round(w / target);
  return { x: 0, y: Math.round((h - height) * p), width: w, height };
}

/** Imagem que representa a publicação em grades e miniaturas (capa do vídeo, se houver). */
export function postCover(post: Post) {
  const m = post.media[0];
  if (!m) return { src: "", alt: post.title, width: 1, height: 1 };
  return { src: m.kind === "video" ? (m.poster ?? "") : m.src, alt: m.alt, width: m.width, height: m.height };
}

/** Referências de arquivos guardados no aparelho, para apagar junto com a publicação. */
export function storedMediaRefs(posts: Post[]) {
  return posts.flatMap((p) => p.media.flatMap((m) => [m.src, m.poster ?? ""])).filter((r) => r.startsWith("idb:"));
}

/** Atualiza dados salvos em versões antigas do app (uma imagem por publicação → lista de mídias). */
export function migrateState(raw: unknown, seed: AppState): AppState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { version?: number; posts?: unknown[] } & Partial<AppState>;
  if (r.version === seed.version) return { ...seed, ...(r as AppState) };
  if (r.version !== 1 || !Array.isArray(r.posts)) return null;
  type OldPost = Omit<Post, "type" | "media"> & { image: string; alt: string };
  const posts: Post[] = (r.posts as OldPost[]).map(({ image, alt, ...rest }) => {
    const media: MediaItem[] = [{ id: `m-${rest.id}`, kind: "image", src: image, alt, width: 1024, height: 1280 }];
    return { ...rest, media, type: "imagem" };
  });
  const ids = new Set(posts.map((p) => p.id));
  const newSeedPosts = seed.posts.filter((p) => !ids.has(p.id));
  return { ...seed, ...(r as unknown as AppState), version: seed.version, posts: [...posts, ...newSeedPosts] };
}

export function parseTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#/, "").trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 10);
}

export function report(
  s: AppState,
  reporterId: string,
  input: { targetType: ReportTarget; targetId: string; reason: string; details: string },
): AppState {
  return {
    ...s,
    reports: [
      { id: uid("r"), reporterId, createdAt: now(), status: "pendente", ...input },
      ...s.reports,
    ],
  };
}

export function resolveReport(
  s: AppState,
  moderatorId: string,
  reportId: string,
  action: "remover" | "arquivar",
): AppState {
  const mod = s.users.find((u) => u.id === moderatorId);
  if (mod?.role !== "moderador") return s;
  const r = s.reports.find((x) => x.id === reportId);
  if (!r) return s;
  let next: AppState = {
    ...s,
    reports: s.reports.map((x) =>
      x.id === reportId ? { ...x, status: action === "remover" ? "removido" : "arquivado" } : x,
    ),
  };
  if (action === "remover") {
    if (r.targetType === "post") {
      next = {
        ...next,
        posts: next.posts.map((p) => (p.id === r.targetId ? { ...p, removed: true } : p)),
      };
    } else if (r.targetType === "comment") {
      next = { ...next, comments: next.comments.filter((c) => c.id !== r.targetId) };
    }
  }
  return next;
}

export function deleteAccount(s: AppState, userId: string): AppState {
  const strip = (m: Record<string, string[]>) =>
    Object.fromEntries(
      Object.entries(m)
        .filter(([k]) => k !== userId)
        .map(([k, v]) => [k, v.filter((x) => x !== userId)]),
    );
  return {
    ...s,
    sessionUserId: null,
    users: s.users.filter((u) => u.id !== userId),
    posts: s.posts
      .filter((p) => p.authorId !== userId)
      .map((p) => ({ ...p, likes: p.likes.filter((l) => l !== userId) })),
    comments: s.comments.filter((c) => c.authorId !== userId),
    notifications: s.notifications.filter((n) => n.userId !== userId && n.actorId !== userId),
    follows: strip(s.follows),
    blocks: strip(s.blocks),
    saved: Object.fromEntries(Object.entries(s.saved).filter(([k]) => k !== userId)),
    eventInterest: Object.fromEntries(
      Object.entries(s.eventInterest).filter(([k]) => k !== userId),
    ),
  };
}
