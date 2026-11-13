import { describe, expect, it } from "vitest";
import { isDuplicateError } from "./errors";
import { rowsToSocial, type SocialRows } from "./mappers";

const empty: SocialRows = {
  posts: [],
  media: [],
  comments: [],
  postLikes: [],
  commentLikes: [],
  profiles: [],
  follows: [],
  saves: [],
  blocks: [],
  stories: [],
  storyViews: [],
  storyReactions: [],
  notifications: [],
  reports: [],
};

const profile = {
  id: "u1",
  username: "ana",
  name: "Ana",
  role: "professor" as const,
  is_moderator: true,
  bio: "",
  bairro: "",
  show_bairro: false,
  color: "lime" as const,
  avatar_url: null,
  cover_url: "https://x/c.webp",
  styles: ["Rap"],
  created_at: "2026-11-01T00:00:00Z",
  pinned_post_id: "p1",
};

describe("linhas do banco viram estado do app", () => {
  it("monta posts com mídias em ordem e curtidas", () => {
    const s = rowsToSocial({
      ...empty,
      posts: [{ id: "p1", author_id: "u1", type: "carrossel", title: "T", description: "D", category: "Grafite", credits: "", tags: ["muro"], region: null, removed: false, created_at: "2026-11-13T10:00:00Z" }],
      media: [
        { id: "m2", post_id: "p1", position: 1, kind: "image", src: "b", poster: null, width: 1, height: 1, alt: "", duration: null },
        { id: "m1", post_id: "p1", position: 0, kind: "video", src: "a", poster: "pa", width: 2, height: 2, alt: "x", duration: 12 },
      ],
      postLikes: [{ post_id: "p1", user_id: "u2" }],
    });
    expect(s.posts[0]).toMatchObject({ id: "p1", authorId: "u1", likes: ["u2"], tags: ["muro"], region: undefined });
    expect(s.posts[0]!.media.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(s.posts[0]!.media[0]).toMatchObject({ kind: "video", poster: "pa", duration: 12 });
  });

  it("monta perfis, comentários e relações", () => {
    const s = rowsToSocial({
      ...empty,
      profiles: [profile],
      comments: [{ id: "c1", post_id: "p1", author_id: "u2", parent_id: null, text: "oi", created_at: "2026-11-13T11:00:00Z" }],
      commentLikes: [{ comment_id: "c1", user_id: "u1" }],
      follows: [{ follower_id: "u2", followee_id: "u1" }, { follower_id: "u2", followee_id: "u3" }],
      saves: [{ user_id: "u2", post_id: "p1" }],
      blocks: [{ blocker_id: "u2", blocked_id: "u9" }],
    });
    expect(s.users[0]).toMatchObject({ id: "u1", role: "professor", isModerator: true, color: "lime", cover: "https://x/c.webp", avatar: undefined, pinnedPostId: "p1" });
    expect(s.comments[0]).toMatchObject({ id: "c1", postId: "p1", parentId: undefined, likes: ["u1"] });
    expect(s.follows).toEqual({ u2: ["u1", "u3"] });
    expect(s.saved).toEqual({ u2: ["p1"] });
    expect(s.blocks).toEqual({ u2: ["u9"] });
  });

  it("monta stories, notificações e denúncias", () => {
    const s = rowsToSocial({
      ...empty,
      stories: [{ id: "s1", author_id: "u1", kind: "image", src: "x", poster: null, width: 1, height: 2, alt: "", duration: null, caption: "c", created_at: "2026-11-13T09:00:00Z" }],
      storyViews: [{ story_id: "s1", user_id: "u2" }],
      storyReactions: [{ story_id: "s1", user_id: "u3" }],
      notifications: [{ id: "n1", user_id: "u1", actor_id: "u2", type: "like", post_id: "p1", text: null, read: false, created_at: "2026-11-13T09:00:00Z" }],
      reports: [{ id: "r1", reporter_id: "u2", target_type: "post", target_id: "p1", reason: "spam", details: "", status: "pendente", created_at: "2026-11-13T09:00:00Z" }],
    });
    expect(s.stories[0]).toMatchObject({ id: "s1", authorId: "u1", caption: "c", viewers: ["u2"], reactions: ["u3"], media: { id: "s1", kind: "image", src: "x", width: 1, height: 2 } });
    expect(s.notifications[0]).toMatchObject({ id: "n1", userId: "u1", actorId: "u2", type: "like", postId: "p1", read: false });
    expect(s.notifications[0]!.text).toBeUndefined();
    expect(s.reports[0]).toMatchObject({ id: "r1", reporterId: "u2", targetType: "post", targetId: "p1", status: "pendente" });
  });
});

describe("erros do banco", () => {
  it("curtida repetida conta como sucesso", () => {
    expect(isDuplicateError({ code: "23505" })).toBe(true);
    expect(isDuplicateError({ code: "42501" })).toBe(false);
    expect(isDuplicateError(null)).toBe(false);
  });
});
