import type { AccountRole } from "../logic";
import type { AppNotification, AppState, Category, Comment, MediaItem, Post, PostType, Report, Story, User } from "../types";

/* Linhas como vêm do Supabase. */

export interface PostRow {
  id: string;
  author_id: string;
  type: PostType;
  title: string;
  description: string;
  category: string;
  credits: string;
  tags: string[];
  region: string | null;
  removed: boolean;
  archived?: boolean;
  created_at: string;
}

export interface MediaRow {
  id: string;
  post_id: string;
  position: number;
  kind: "image" | "video";
  src: string;
  poster: string | null;
  width: number;
  height: number;
  alt: string;
  duration: number | null;
}

export interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  text: string;
  created_at: string;
}

export interface StoryRow {
  id: string;
  author_id: string;
  kind: "image" | "video";
  src: string;
  poster: string | null;
  width: number;
  height: number;
  alt: string;
  duration: number | null;
  caption: string;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  actor_id: string;
  type: AppNotification["type"];
  post_id: string | null;
  text: string | null;
  read: boolean;
  created_at: string;
}

export interface ReportRow {
  id: string;
  reporter_id: string;
  target_type: Report["targetType"];
  target_id: string;
  reason: string;
  details: string;
  status: Report["status"];
  created_at: string;
  media_path?: string | null;
}

export interface PublicProfileRow {
  id: string;
  username: string;
  name: string;
  role: AccountRole;
  is_moderator: boolean;
  bio: string;
  bairro: string;
  show_bairro: boolean;
  color: User["color"];
  avatar_url: string | null;
  cover_url: string | null;
  styles: string[];
  created_at: string;
  pinned_post_id: string | null;
}

export interface SocialRows {
  posts: PostRow[];
  media: MediaRow[];
  comments: CommentRow[];
  postLikes: { post_id: string; user_id: string }[];
  commentLikes: { comment_id: string; user_id: string }[];
  profiles: PublicProfileRow[];
  follows: { follower_id: string; followee_id: string }[];
  saves: { user_id: string; post_id: string }[];
  blocks: { blocker_id: string; blocked_id: string }[];
  stories: StoryRow[];
  storyViews: { story_id: string; user_id: string }[];
  storyReactions: { story_id: string; user_id: string }[];
  notifications: NotificationRow[];
  reports: ReportRow[];
}

export type SocialSlice = Pick<
  AppState,
  "users" | "posts" | "comments" | "follows" | "saved" | "blocks" | "stories" | "notifications" | "reports"
>;

function groupBy<T>(rows: T[], key: (r: T) => string, value: (r: T) => string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[key(r)] ??= []).push(value(r));
  return out;
}

const orUndefined = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

export function mediaRowToItem(m: Omit<MediaRow, "post_id" | "position">): MediaItem {
  return {
    id: m.id,
    kind: m.kind,
    src: m.src,
    poster: orUndefined(m.poster),
    width: m.width,
    height: m.height,
    alt: m.alt,
    duration: orUndefined(m.duration),
  };
}

export function profileRowToUser(p: PublicProfileRow): User {
  return {
    id: p.id,
    username: p.username,
    name: p.name,
    avatar: orUndefined(p.avatar_url),
    cover: orUndefined(p.cover_url),
    pinnedPostId: orUndefined(p.pinned_post_id),
    color: p.color,
    bio: p.bio,
    bairro: p.bairro,
    showBairro: p.show_bairro,
    styles: p.styles as Category[],
    role: p.role,
    isModerator: p.is_moderator,
    createdAt: p.created_at,
  };
}

/** Junta as linhas do banco no formato que as telas já usam. */
export function rowsToSocial(r: SocialRows): SocialSlice {
  const mediaByPost: Record<string, MediaRow[]> = {};
  for (const m of r.media) (mediaByPost[m.post_id] ??= []).push(m);
  const postLikes = groupBy(r.postLikes, (l) => l.post_id, (l) => l.user_id);
  const commentLikes = groupBy(r.commentLikes, (l) => l.comment_id, (l) => l.user_id);
  const views = groupBy(r.storyViews, (v) => v.story_id, (v) => v.user_id);
  const reactions = groupBy(r.storyReactions, (v) => v.story_id, (v) => v.user_id);

  const posts: Post[] = r.posts.map((p) => ({
    id: p.id,
    authorId: p.author_id,
    type: p.type,
    media: (mediaByPost[p.id] ?? []).sort((a, b) => a.position - b.position).map(mediaRowToItem),
    title: p.title,
    description: p.description,
    category: p.category as Category,
    credits: p.credits,
    tags: p.tags,
    region: orUndefined(p.region),
    likes: postLikes[p.id] ?? [],
    createdAt: p.created_at,
    removed: p.removed,
    archived: p.archived ?? false,
  }));

  const comments: Comment[] = r.comments.map((c) => ({
    id: c.id,
    postId: c.post_id,
    authorId: c.author_id,
    text: c.text,
    parentId: orUndefined(c.parent_id),
    likes: commentLikes[c.id] ?? [],
    createdAt: c.created_at,
  }));

  const stories: Story[] = r.stories.map((st) => ({
    id: st.id,
    authorId: st.author_id,
    media: mediaRowToItem(st),
    caption: st.caption,
    createdAt: st.created_at,
    viewers: views[st.id] ?? [],
    reactions: reactions[st.id] ?? [],
  }));

  const notifications: AppNotification[] = r.notifications.map((n) => ({
    id: n.id,
    userId: n.user_id,
    actorId: n.actor_id,
    type: n.type,
    ...(n.post_id ? { postId: n.post_id } : {}),
    ...(n.text ? { text: n.text } : {}),
    createdAt: n.created_at,
    read: n.read,
  }));

  const reports: Report[] = r.reports.map((x) => ({
    id: x.id,
    reporterId: x.reporter_id,
    targetType: x.target_type,
    targetId: x.target_id,
    reason: x.reason,
    details: x.details,
    createdAt: x.created_at,
    status: x.status,
    ...(x.media_path ? { mediaPath: x.media_path } : {}),
  }));

  return {
    users: r.profiles.map(profileRowToUser),
    posts,
    comments,
    follows: groupBy(r.follows, (f) => f.follower_id, (f) => f.followee_id),
    saved: groupBy(r.saves, (s) => s.user_id, (s) => s.post_id),
    blocks: groupBy(r.blocks, (b) => b.blocker_id, (b) => b.blocked_id),
    stories,
    notifications,
    reports,
  };
}
