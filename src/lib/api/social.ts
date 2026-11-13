import { getSupabase } from "../supabase";
import type { Category, MediaItem, ReportTarget } from "../types";
import { isDuplicateError } from "./errors";
import { removeUploads } from "./media";
import {
  rowsToSocial,
  type CommentRow,
  type MediaRow,
  type NotificationRow,
  type PostRow,
  type PublicProfileRow,
  type ReportRow,
  type SocialSlice,
  type StoryRow,
} from "./mappers";

export const SNAPSHOT_POSTS = 300;

type DbError = { code?: string; message: string } | null;

/** Erro do banco → mensagem em português. Linha repetida conta como sucesso. */
function check(error: DbError, message: string) {
  if (!error || isDuplicateError(error)) return;
  const offline = /failed to fetch|network/i.test(error.message);
  throw new Error(offline ? "Sem conexão com a internet. Tente de novo." : message);
}

type PostWithChildren = PostRow & {
  post_media: Omit<MediaRow, "post_id">[];
  post_likes: { user_id: string }[];
  comments: (CommentRow & { comment_likes: { user_id: string }[] })[];
};

type StoryWithChildren = StoryRow & {
  story_views: { user_id: string }[];
  story_reactions: { user_id: string }[];
};

/** Tudo o que o app precisa ao abrir: posts recentes, perfis, relações, stories, avisos e denúncias. */
export async function fetchSnapshot(userId: string): Promise<SocialSlice> {
  const db = getSupabase();
  const [posts, profiles, follows, saves, blocks, stories, notifications, reports] = await Promise.all([
    db
      .from("posts")
      .select("*, post_media(*), post_likes(user_id), comments(*, comment_likes(user_id))")
      .order("created_at", { ascending: false })
      .limit(SNAPSHOT_POSTS),
    db.from("public_profiles").select("*"),
    db.from("follows").select("follower_id, followee_id"),
    db.from("saves").select("user_id, post_id").eq("user_id", userId),
    db.from("blocks").select("blocker_id, blocked_id").eq("blocker_id", userId),
    db
      .from("stories")
      .select("*, story_views(user_id), story_reactions(user_id)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true }),
    db.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
    db.from("reports").select("*").order("created_at", { ascending: false }).limit(200),
  ]);
  for (const r of [posts, profiles, follows, saves, blocks, stories, notifications, reports]) {
    check(r.error, "Não conseguimos carregar o feed. Tente de novo.");
  }

  const postRows = (posts.data ?? []) as PostWithChildren[];
  const storyRows = (stories.data ?? []) as StoryWithChildren[];
  return rowsToSocial({
    posts: postRows,
    media: postRows.flatMap((p) => p.post_media.map((m) => ({ ...m, post_id: p.id }))),
    postLikes: postRows.flatMap((p) => p.post_likes.map((l) => ({ post_id: p.id, user_id: l.user_id }))),
    comments: postRows.flatMap((p) => p.comments),
    commentLikes: postRows.flatMap((p) =>
      p.comments.flatMap((c) => c.comment_likes.map((l) => ({ comment_id: c.id, user_id: l.user_id }))),
    ),
    profiles: (profiles.data ?? []) as PublicProfileRow[],
    follows: follows.data ?? [],
    saves: saves.data ?? [],
    blocks: blocks.data ?? [],
    stories: storyRows,
    storyViews: storyRows.flatMap((s) => s.story_views.map((v) => ({ story_id: s.id, user_id: v.user_id }))),
    storyReactions: storyRows.flatMap((s) => s.story_reactions.map((v) => ({ story_id: s.id, user_id: v.user_id }))),
    notifications: (notifications.data ?? []) as NotificationRow[],
    reports: (reports.data ?? []) as ReportRow[],
  });
}

const me = async () => {
  const { data } = await getSupabase().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Entre na sua conta.");
  return id;
};

/* ---------- Posts ---------- */

export interface NewPostInput {
  type: PostRow["type"];
  title: string;
  description: string;
  category: Category;
  credits: string;
  tags: string[];
  region?: string | undefined;
  media: MediaItem[];
}

/** Cria o post e suas mídias; se as mídias falharem, apaga o post. Devolve o id. */
export async function insertPost(input: NewPostInput): Promise<string> {
  const db = getSupabase();
  const author_id = await me();
  const { data, error } = await db
    .from("posts")
    .insert({
      author_id,
      type: input.type,
      title: input.title,
      description: input.description,
      category: input.category,
      credits: input.credits,
      tags: input.tags,
      region: input.region ?? null,
    })
    .select("id")
    .single();
  check(error, "Não conseguimos publicar. Tente de novo.");
  const postId = (data as { id: string }).id;
  const media = input.media.map((m, position) => ({
    post_id: postId,
    position,
    kind: m.kind,
    src: m.src,
    poster: m.poster ?? null,
    width: Math.round(m.width),
    height: Math.round(m.height),
    alt: m.alt,
    duration: m.duration ?? null,
  }));
  const res = await db.from("post_media").insert(media);
  if (res.error) {
    await db.from("posts").delete().eq("id", postId);
    check(res.error, "Não conseguimos publicar. Tente de novo.");
  }
  return postId;
}

/** Apaga o post e, depois, os arquivos dele no bucket. */
export async function deletePost(id: string, paths: string[] = []) {
  const { error } = await getSupabase().from("posts").delete().eq("id", id);
  check(error, "Não conseguimos apagar a publicação.");
  await removeUploads(paths).catch(() => {});
}

export async function setLike(postId: string, on: boolean) {
  const db = getSupabase();
  const user_id = await me();
  const { error } = on
    ? await db.from("post_likes").insert({ post_id: postId, user_id })
    : await db.from("post_likes").delete().eq("post_id", postId).eq("user_id", user_id);
  check(error, "Não conseguimos registrar a curtida.");
}

export async function setSave(postId: string, on: boolean) {
  const db = getSupabase();
  const user_id = await me();
  const { error } = on
    ? await db.from("saves").insert({ post_id: postId, user_id })
    : await db.from("saves").delete().eq("post_id", postId).eq("user_id", user_id);
  check(error, "Não conseguimos salvar.");
}

export async function setArchived(postId: string, archived: boolean) {
  const { data, error } = await getSupabase().from("posts").update({ archived }).eq("id", postId).select("id");
  check(error, "Não conseguimos arquivar a publicação.");
  if (!data?.length) throw new Error("Não conseguimos arquivar a publicação.");
}

export async function updatePostText(postId: string, patch: { title: string; description: string; tags: string[] }) {
  const { data, error } = await getSupabase().from("posts").update(patch).eq("id", postId).select("id");
  check(error, "Não conseguimos salvar a legenda.");
  if (!data?.length) throw new Error("Não conseguimos salvar a legenda.");
}

export async function setRemoved(postId: string, removed: boolean) {
  const { data, error } = await getSupabase().from("posts").update({ removed }).eq("id", postId).select("id");
  check(error, "Não conseguimos atualizar a publicação.");
  if (!data?.length) throw new Error("Não conseguimos atualizar a publicação.");
}

/* ---------- Comentários ---------- */

export async function addComment(postId: string, text: string, parentId?: string): Promise<string> {
  const db = getSupabase();
  const author_id = await me();
  const { data, error } = await db
    .from("comments")
    .insert({ post_id: postId, author_id, text, parent_id: parentId ?? null })
    .select("id")
    .single();
  check(error, "Não conseguimos enviar o comentário.");
  return (data as { id: string }).id;
}

export async function deleteComment(id: string) {
  const { data, error } = await getSupabase().from("comments").delete().eq("id", id).select("id");
  check(error, "Não conseguimos apagar o comentário.");
  if (!data?.length) throw new Error("Não conseguimos apagar o comentário.");
}

export async function setCommentLike(commentId: string, on: boolean) {
  const db = getSupabase();
  const user_id = await me();
  const { error } = on
    ? await db.from("comment_likes").insert({ comment_id: commentId, user_id })
    : await db.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", user_id);
  check(error, "Não conseguimos registrar a curtida.");
}

export async function notifyMentions(postId: string, commentId: string | null, usernames: string[]) {
  if (usernames.length === 0) return;
  const { error } = await getSupabase().rpc("notify_mentions", {
    p_post: postId,
    p_comment: commentId,
    p_usernames: usernames.slice(0, 10),
  });
  // Menção que falha não deve atrapalhar o post/comentário já salvo.
  if (error) console.warn("notify_mentions", error.message);
}

/* ---------- Pessoas ---------- */

export async function setFollow(targetId: string, on: boolean) {
  const db = getSupabase();
  const follower_id = await me();
  const { error } = on
    ? await db.from("follows").insert({ follower_id, followee_id: targetId })
    : await db.from("follows").delete().eq("follower_id", follower_id).eq("followee_id", targetId);
  check(error, "Não conseguimos atualizar quem você segue.");
}

export async function setBlock(targetId: string, on: boolean) {
  const db = getSupabase();
  const blocker_id = await me();
  if (on) {
    const { error } = await db.from("blocks").insert({ blocker_id, blocked_id: targetId });
    check(error, "Não conseguimos bloquear.");
    // Bloquear também desfaz o seguir nos dois sentidos.
    await db.from("follows").delete().eq("follower_id", blocker_id).eq("followee_id", targetId);
    await db.from("follows").delete().eq("follower_id", targetId).eq("followee_id", blocker_id);
  } else {
    const { error } = await db.from("blocks").delete().eq("blocker_id", blocker_id).eq("blocked_id", targetId);
    check(error, "Não conseguimos desbloquear.");
  }
}

/* ---------- Stories ---------- */

export async function insertStory(media: MediaItem, caption: string): Promise<string> {
  const db = getSupabase();
  const author_id = await me();
  const { data, error } = await db
    .from("stories")
    .insert({
      author_id,
      kind: media.kind,
      src: media.src,
      poster: media.poster ?? null,
      width: Math.round(media.width),
      height: Math.round(media.height),
      alt: media.alt,
      duration: media.duration ?? null,
      caption,
    })
    .select("id")
    .single();
  check(error, "Não conseguimos publicar o story.");
  return (data as { id: string }).id;
}

export async function deleteStory(id: string, paths: string[] = []) {
  const { error } = await getSupabase().from("stories").delete().eq("id", id);
  check(error, "Não conseguimos apagar o story.");
  await removeUploads(paths).catch(() => {});
}

export async function markStoryViewed(storyId: string) {
  const user_id = await me();
  const { error } = await getSupabase().from("story_views").insert({ story_id: storyId, user_id });
  check(error, "Não conseguimos marcar o story como visto.");
}

export async function reactToStory(storyId: string) {
  const user_id = await me();
  const { error } = await getSupabase().from("story_reactions").insert({ story_id: storyId, user_id });
  check(error, "Não conseguimos mandar o 🔥.");
}

/* ---------- Avisos e moderação ---------- */

export async function markNotificationsRead() {
  const user_id = await me();
  const { error } = await getSupabase().from("notifications").update({ read: true }).eq("user_id", user_id).eq("read", false);
  check(error, "Não conseguimos marcar os avisos como lidos.");
}

export async function insertReport(input: { targetType: ReportTarget; targetId: string; reason: string; details: string }) {
  const reporter_id = await me();
  const { error } = await getSupabase().from("reports").insert({
    reporter_id,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: input.details,
  });
  check(error, "Não conseguimos enviar a denúncia.");
}

/** Moderador decide: "remover" esconde o post denunciado; "arquivar" só fecha a denúncia. */
export async function resolveReport(report: { id: string; targetType: ReportTarget; targetId: string }, action: "remover" | "arquivar") {
  if (action === "remover" && report.targetType === "post") await setRemoved(report.targetId, true);
  if (action === "remover" && report.targetType === "comment") await deleteComment(report.targetId);
  const { error } = await getSupabase()
    .from("reports")
    .update({ status: action === "remover" ? "removido" : "arquivado" })
    .eq("id", report.id);
  check(error, "Não conseguimos atualizar a denúncia.");
}

/* ---------- Perfil ---------- */

export async function setPinnedPost(postId: string | null) {
  const id = await me();
  const { error } = await getSupabase().from("profiles").update({ pinned_post_id: postId }).eq("id", id);
  check(error, "Não conseguimos atualizar o destaque do perfil.");
}

export async function setProfileImages(patch: { avatar_url?: string | null; cover_url?: string | null }) {
  const id = await me();
  const { error } = await getSupabase().from("profiles").update(patch).eq("id", id);
  check(error, "Não conseguimos salvar a imagem do perfil.");
}
