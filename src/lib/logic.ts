import type { AppState, Category, Comment, MediaItem, Post, PostType, ReportTarget, Story, User } from "./types";

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

/* ---------- Contas: idade e papel ---------- */

export type AccountRole = "aluno" | "professor";
export const MIN_AGE = 13;

/** Idade em anos completos. `birthDate` é "AAAA-MM-DD"; usa só o calendário, sem fuso. */
export function ageOn(birthDate: string, today: Date): number {
  const [y, m, d] = birthDate.split("-").map(Number) as [number, number, number];
  const month = today.getMonth() + 1;
  const hadBirthday = month > m || (month === m && today.getDate() >= d);
  return today.getFullYear() - y - (hadBirthday ? 0 : 1);
}

export function needsRoleChoice(age: number): boolean {
  return age >= 20 && age <= 30;
}

export function roleForAge(age: number, choice?: AccountRole): AccountRole {
  if (age < 20) return "aluno";
  if (age > 30) return "professor";
  return choice ?? "aluno";
}

export interface SignUpInput {
  name: string;
  username: string;
  email: string;
  password: string;
  birthDate: string;
  roleChoice?: AccountRole | undefined;
  acceptedRules: boolean;
}

/** Primeira mensagem de erro do cadastro, ou null se estiver tudo certo. */
export function validateSignUp(input: SignUpInput, today: Date): string | null {
  if (!input.name.trim()) return "Informe seu nome de exibição.";
  if (!isValidUsername(normalizeUsername(input.username)))
    return "Usuário deve ter 3 a 20 caracteres: letras, números, ponto ou _.";
  if (!/^\S+@\S+\.\S+$/.test(input.email.trim())) return "E-mail inválido.";
  if (input.password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!input.birthDate) return "Informe sua data de nascimento.";
  const age = /^\d{4}-\d{2}-\d{2}$/.test(input.birthDate) ? ageOn(input.birthDate, today) : NaN;
  if (!Number.isFinite(age) || age < 0 || age > 120) return "Data de nascimento inválida.";
  if (age < MIN_AGE) return "Você precisa ter pelo menos 13 anos para criar uma conta.";
  if (!input.acceptedRules) return "Você precisa aceitar as regras de convivência.";
  return null;
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

/** Contas existentes mencionadas, sem repetir, sem auto-menção nem bloqueados. */
export function mentionedUsers(s: AppState, actorId: string, text: string): User[] {
  const names = new Set([...text.matchAll(/(?:^|[^a-z0-9._@])@([a-z0-9._]{3,20})(?![a-z0-9._])/gi)].map((m) => normalizeUsername(m[1] ?? "")));
  return s.users.filter((u) => names.has(u.username) && u.id !== actorId && !isBlockedBetween(s, actorId, u.id));
}

function mentionNotifications(s: AppState, actorId: string, postId: string, text: string) {
  return mentionedUsers(s, actorId, text).map((u) => ({ id: uid("n"), userId: u.id, actorId, postId, type: "mention" as const, text: text.slice(0, 80), createdAt: now(), read: false }));
}

/** Respostas ficam sempre penduradas no comentário raiz (só um nível de resposta). */
export function rootCommentId(comments: Pick<Comment, "id" | "parentId">[], parentId: string | undefined): string | undefined {
  if (!parentId) return undefined;
  const parent = comments.find((c) => c.id === parentId);
  return parent?.parentId ?? parentId;
}

export function addComment(s: AppState, userId: string, postId: string, text: string, parentId?: string): AppState {
  const clean = text.trim().slice(0, 500);
  const post = s.posts.find((p) => p.id === postId && !p.removed);
  if (!clean || !post || isBlockedBetween(s, userId, post.authorId)) return s;
  const parent = parentId ? s.comments.find((c) => c.id === parentId && c.postId === postId) : undefined;
  if (parentId && (!parent || isBlockedBetween(s, userId, parent.authorId))) return s;
  const comment = { id: uid("c"), postId, authorId: userId, text: clean, parentId: parent?.parentId ?? parent?.id, likes: [], createdAt: now() };
  const notices: AppState["notifications"] = mentionNotifications(s, userId, postId, clean);
  const recipients = new Map<string, "reply" | "comment">();
  if (post.authorId !== userId) recipients.set(post.authorId, "comment");
  if (parent && parent.authorId !== userId) recipients.set(parent.authorId, "reply");
  for (const [recipient, type] of recipients) {
    if (isBlockedBetween(s, userId, recipient)) continue;
    notices.push({ id: uid("n"), userId: recipient, actorId: userId, postId, type, text: clean.slice(0, 80), createdAt: now(), read: false });
  }
  return { ...s, comments: [...s.comments, comment], notifications: [...notices, ...s.notifications] };
}

export function toggleCommentLike(s: AppState, userId: string, commentId: string): AppState {
  const c = s.comments.find((x) => x.id === commentId);
  const post = c && s.posts.find((p) => p.id === c.postId && !p.removed);
  if (!c || !post || isBlockedBetween(s, userId, c.authorId) || isBlockedBetween(s, userId, post.authorId)) return s;
  const liked = c.likes.includes(userId);
  return { ...s, comments: s.comments.map((x) => x.id === commentId ? { ...x, likes: liked ? x.likes.filter((id) => id !== userId) : [...x.likes, userId] } : x), notifications: !liked && c.authorId !== userId ? [{ id: uid("n"), userId: c.authorId, actorId: userId, type: "commentLike", postId: c.postId, createdAt: now(), read: false }, ...s.notifications] : s.notifications };
}

export type ProfilePatch = Partial<Pick<User, "name" | "username" | "bio" | "bairro" | "showBairro" | "styles" | "avatar" | "cover" | "color" | "pinnedPostId">>;
export function updateProfile(s: AppState, userId: string, patch: ProfilePatch): Result {
  if (!s.users.some((u) => u.id === userId)) return { ok: false, error: "Entre na sua conta." };
  const clean = { ...patch };
  if (clean.username !== undefined) {
    clean.username = normalizeUsername(clean.username);
    if (!isValidUsername(clean.username)) return { ok: false, error: "Usuário deve ter 3 a 20 caracteres: letras, números, ponto ou _." };
    if (s.users.some((u) => u.id !== userId && u.username === clean.username)) return { ok: false, error: "Esse nome de usuário já está em uso." };
  }
  if (clean.name !== undefined && !clean.name.trim()) return { ok: false, error: "Informe seu nome." };
  if (clean.pinnedPostId && !s.posts.some((p) => p.id === clean.pinnedPostId && p.authorId === userId && !p.removed)) return { ok: false, error: "Escolha uma obra sua para destacar." };
  return { ok: true, state: { ...s, users: s.users.map((u) => u.id === userId ? { ...u, ...clean } : u) } };
}

export function mostLikedPosts(s: AppState, viewerId: string | null) {
  return visiblePosts(s, viewerId).sort((a, b) => b.likes.length - a.likes.length || b.createdAt.localeCompare(a.createdAt));
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

export function isBlockedBetween(s: Pick<AppState, "blocks">, a: string, b: string) {
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
  return { id, state: { ...s, posts: [post, ...s.posts], notifications: [...mentionNotifications(s, userId, id, `${data.description} ${data.credits}`), ...s.notifications] } };
}

/* ---------- Fotos e vídeos ---------- */

export const MAX_MEDIA = 10;
export const MAX_VIDEO_SECONDS = 60;
export const MAX_VIDEO_MB = 50;
export const MAX_IMAGE_MB = 20;

/* ---------- Destaques de professores ---------- */

export const HIGHLIGHT_DAYS = 7;
export const HIGHLIGHT_MAX = 10;

/** Posts recentes de professores para a faixa "Destaques" do feed. */
export function highlightPosts(
  s: Pick<AppState, "posts" | "users" | "blocks">,
  viewerId: string,
  nowMs: number,
  { days = HIGHLIGHT_DAYS, max = HIGHLIGHT_MAX }: { days?: number; max?: number } = {},
): Post[] {
  const professors = new Set(s.users.filter((u) => u.role === "professor").map((u) => u.id));
  const since = nowMs - days * 24 * 60 * 60 * 1000;
  return s.posts
    .filter((p) => !p.removed && professors.has(p.authorId) && !isBlockedBetween(s, viewerId, p.authorId))
    .filter((p) => Date.parse(p.createdAt) >= since)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, max);
}

/* ---------- Vídeos: comprimir, enviar ou recusar ---------- */

export type VideoSupport = { canCompress: boolean };
export const VIDEO_FALLBACK_MB = 15;

export function videoPlan(
  support: VideoSupport,
  sizeBytes: number,
  durationSec: number,
): { action: "comprimir" | "enviar" } | { action: "recusar"; error: string } {
  if (durationSec > MAX_VIDEO_SECONDS) return { action: "recusar", error: `O vídeo pode ter no máximo ${MAX_VIDEO_SECONDS} segundos.` };
  if (support.canCompress) return { action: "comprimir" };
  if (sizeBytes <= VIDEO_FALLBACK_MB * 1e6) return { action: "enviar" };
  return { action: "recusar", error: "Esse vídeo é grande demais para este aparelho. Grave um vídeo mais curto." };
}

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

/** Atualiza dados salvos em versões antigas do app, uma versão de cada vez. */
/**
 * Lê o que estava salvo no navegador. Desde a versão 6 os dados sociais vêm do Supabase,
 * então versões antigas viram estado limpo e só as preferências da pessoa são mantidas.
 */
export function migrateState(raw: unknown, empty: AppState): AppState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<AppState> & { version?: number };
  const keep = {
    settings: { ...empty.settings, ...(r.settings ?? {}) },
    eventInterest: r.eventInterest ?? {},
  };
  if (r.version !== empty.version) return { ...empty, ...keep };
  return { ...empty, ...(r as AppState), ...keep };
}

/* ---------- Stories ---------- */

export const STORY_HOURS = 24;
export const STORY_IMAGE_SECONDS = 6;
const STORY_MS = STORY_HOURS * 60 * 60 * 1000;

export function isStoryActive(story: Story, nowMs = Date.now()) {
  const age = nowMs - new Date(story.createdAt).getTime();
  return age >= 0 && age < STORY_MS;
}

export function createStory(
  s: AppState,
  userId: string,
  media: MediaItem,
  caption: string,
): { state: AppState; id: string } {
  const id = uid("s");
  const story: Story = { id, authorId: userId, media, caption: caption.trim().slice(0, 120), createdAt: now(), viewers: [], reactions: [] };
  return { id, state: { ...s, stories: [...s.stories, story] } };
}

export type StoryGroup = { user: User; stories: Story[]; seen: boolean };

/**
 * Stories que a pessoa vê, agrupados por autor: os próprios primeiro,
 * depois quem ela segue (não vistos antes). Quem ainda não segue ninguém vê a comunidade toda.
 */
export function storyGroups(s: Pick<AppState, "stories" | "follows" | "blocks" | "users">, viewerId: string, nowMs = Date.now()): StoryGroup[] {
  const following = s.follows[viewerId] ?? [];
  const showAll = following.length === 0;
  const byAuthor = new Map<string, Story[]>();
  for (const st of s.stories) {
    if (!isStoryActive(st, nowMs)) continue;
    const mine = st.authorId === viewerId;
    if (!mine && !showAll && !following.includes(st.authorId)) continue;
    if (!mine && isBlockedBetween(s, viewerId, st.authorId)) continue;
    byAuthor.set(st.authorId, [...(byAuthor.get(st.authorId) ?? []), st]);
  }
  const groups: StoryGroup[] = [];
  for (const [authorId, list] of byAuthor) {
    const user = s.users.find((u) => u.id === authorId);
    if (!user) continue;
    const stories = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    groups.push({ user, stories, seen: stories.every((st) => st.viewers.includes(viewerId) || st.authorId === viewerId) });
  }
  return groups.sort((a, b) => {
    if (a.user.id === viewerId) return -1;
    if (b.user.id === viewerId) return 1;
    if (a.seen !== b.seen) return a.seen ? 1 : -1;
    return (b.stories.at(-1)?.createdAt ?? "").localeCompare(a.stories.at(-1)?.createdAt ?? "");
  });
}

export function markStoryViewed(s: AppState, userId: string, storyId: string): AppState {
  const st = s.stories.find((x) => x.id === storyId);
  if (!st || st.authorId === userId || st.viewers.includes(userId)) return s;
  return { ...s, stories: s.stories.map((x) => (x.id === storyId ? { ...x, viewers: [...x.viewers, userId] } : x)) };
}

/** Manda 🔥 no story (uma vez por pessoa) e avisa o autor. */
export function reactToStory(s: AppState, userId: string, storyId: string): AppState {
  const st = s.stories.find((x) => x.id === storyId);
  if (!st || st.authorId === userId || st.reactions.includes(userId)) return s;
  return {
    ...s,
    stories: s.stories.map((x) => (x.id === storyId ? { ...x, reactions: [...x.reactions, userId] } : x)),
    notifications: [
      { id: uid("n"), userId: st.authorId, actorId: userId, type: "story", createdAt: now(), read: false },
      ...s.notifications,
    ],
  };
}

export function deleteStory(s: AppState, userId: string, storyId: string): AppState {
  if (!s.stories.some((x) => x.id === storyId && x.authorId === userId)) return s;
  return { ...s, stories: s.stories.filter((x) => x.id !== storyId) };
}

/** Stories vencidos há mais de um dia: podem ser apagados do aparelho. */
export function expiredStories(s: AppState, nowMs = Date.now()) {
  return s.stories.filter((st) => nowMs - new Date(st.createdAt).getTime() > 2 * STORY_MS);
}

export function storyMediaRefs(stories: Story[]) {
  return stories.flatMap((st) => [st.media.src, st.media.poster ?? ""]).filter((r) => r.startsWith("idb:"));
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
  if (!mod?.isModerator) return s;
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
    comments: s.comments.filter((c) => c.authorId !== userId).map((c) => ({ ...c, likes: c.likes.filter((id) => id !== userId), parentId: s.comments.some((p) => p.id === c.parentId && p.authorId === userId) ? undefined : c.parentId })),
    stories: s.stories
      .filter((st) => st.authorId !== userId)
      .map((st) => ({ ...st, viewers: st.viewers.filter((v) => v !== userId), reactions: st.reactions.filter((v) => v !== userId) })),
    notifications: s.notifications.filter((n) => n.userId !== userId && n.actorId !== userId),
    follows: strip(s.follows),
    blocks: strip(s.blocks),
    saved: Object.fromEntries(Object.entries(s.saved).filter(([k]) => k !== userId)),
    eventInterest: Object.fromEntries(
      Object.entries(s.eventInterest).filter(([k]) => k !== userId),
    ),
  };
}
