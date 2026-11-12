import { describe, expect, it } from "vitest";
import { createSeedState } from "./mock-data";
import * as L from "./logic";

describe("regras da rede", () => {
  it("menções entre contas notificam uma vez por conta e excluem bloqueados", () => {
    const s = L.toggleBlock(createSeedState(), "u8", "u2");
    const maria = s.users.find((u) => u.id === "u1");
    const blocked = s.users.find((u) => u.id === "u2");
    const me = s.users.find((u) => u.id === "u8");
    const next = L.addComment(s, "u8", "p1", `@${maria?.username} @${maria?.username} @${blocked?.username} @${me?.username}`);
    expect(next.notifications.filter((n) => n.type === "mention").map((n) => n.userId)).toEqual(["u1"]);
  });

  it("menções em posts notificam as contas citadas", () => {
    const s = createSeedState();
    const result = L.createPost(s, "u8", { media: [], title: "Arte", description: "Com @mariacores", category: "Grafite", credits: "@mariacores", tags: [] });
    expect(result.state.notifications.filter((n) => n.type === "mention")).toHaveLength(1);
    expect(result.state.notifications[0]).toMatchObject({ userId: "u1", postId: result.id });
  });

  it("respostas mantêm a conversa e avisam o autor do comentário", () => {
    const s = L.addComment(createSeedState(), "u8", "p1", "Que arte!", "c1");
    expect(s.comments.at(-1)).toMatchObject({ parentId: "c1", text: "Que arte!" });
    expect(s.notifications.some((n) => n.type === "reply" && n.userId === "u3")).toBe(true);
  });

  it("curtidas em comentários podem ser desfeitas", () => {
    const s = L.toggleCommentLike(createSeedState(), "u8", "c1");
    expect(s.comments.find((c) => c.id === "c1")?.likes).toEqual(["u8"]);
    expect(s.notifications[0]).toMatchObject({ type: "commentLike", userId: "u3" });
    expect(L.toggleCommentLike(s, "u8", "c1").comments.find((c) => c.id === "c1")?.likes).toEqual([]);
  });

  it("posts mais curtidos ficam em ordem decrescente sem removidos ou bloqueados", () => {
    const seed = createSeedState();
    const s = L.toggleBlock({ ...seed, posts: seed.posts.map((p) => ({ ...p, likes: p.id === "p2" ? ["u1", "u3", "u4"] : p.id === "p3" ? ["u1", "u4"] : [], removed: p.id === "p4" })) }, "u8", "u1");
    const posts = L.mostLikedPosts(s, "u8");
    expect(posts.slice(0, 2).map((p) => p.id)).toEqual(["p2", "p3"]);
    expect(posts.some((p) => p.id === "p4" || p.authorId === "u1")).toBe(false);
  });

  it("personalização salva a cor e capa mas só destaca uma obra própria", () => {
    const s = createSeedState();
    expect(L.updateProfile(s, "u8", { pinnedPostId: "p1" }).ok).toBe(false);
    const r = L.updateProfile(s, "u1", { color: "lime", cover: "data:photo", pinnedPostId: "p1" });
    expect(r.ok && r.state.users.find((u) => u.id === "u1")).toMatchObject({ color: "lime", cover: "data:photo", pinnedPostId: "p1" });
  });

  it("migração mantém comentários anteriores com curtidas vazias", () => {
    const seed = createSeedState();
    const migrated = L.migrateState({ ...seed, version: 3, comments: seed.comments.map(({ likes: _likes, ...c }) => c) }, seed);
    expect(migrated?.comments.find((c) => c.id === "c1")?.likes).toEqual([]);
    expect(migrated?.users).toEqual(seed.users);
  });
  it("não permite cadastrar usuário já existente", () => {
    const r = L.signUp(createSeedState(), { name: "X", username: "mariacores", email: "x@x.com", password: "123456" });
    expect(r.ok).toBe(false);
  });

  it("cadastro válido já entra na conta", () => {
    const r = L.signUp(createSeedState(), { name: "Nova", username: "nova.arte", email: "n@x.com", password: "123456" });
    expect(r.ok && r.state.sessionUserId).toBeTruthy();
  });

  it("senha precisa ter pelo menos 6 caracteres", () => {
    const r = L.signUp(createSeedState(), { name: "A", username: "abc", email: "a@b.com", password: "12345" });
    expect(r.ok).toBe(false);
  });

  it("curtir de novo desfaz a curtida", () => {
    let s = createSeedState();
    s = L.toggleLike(s, "u5", "p1");
    expect(s.posts.find((p) => p.id === "p1")!.likes).toContain("u5");
    s = L.toggleLike(s, "u5", "p1");
    expect(s.posts.find((p) => p.id === "p1")!.likes).not.toContain("u5");
  });

  it("curtir notifica o autor da publicação", () => {
    const s = L.toggleLike(createSeedState(), "u5", "p1");
    expect(s.notifications[0]).toMatchObject({ userId: "u1", actorId: "u5", type: "like" });
  });

  it("bloquear esconde as publicações do autor e desfaz o seguir", () => {
    const s = L.toggleBlock(createSeedState(), "u8", "u1");
    expect(L.visiblePosts(s, "u8").some((p) => p.authorId === "u1")).toBe(false);
    expect(s.follows["u8"]).not.toContain("u1");
  });

  it("só moderador pode remover conteúdo denunciado", () => {
    let s = L.report(createSeedState(), "u3", { targetType: "post", targetId: "p2", reason: "Spam", details: "" });
    const id = s.reports[0]!.id;
    expect(L.resolveReport(s, "u1", id, "remover")).toBe(s);
    s = L.resolveReport(s, "u8", id, "remover");
    expect(s.posts.find((p) => p.id === "p2")!.removed).toBe(true);
  });

  it("uma mídia é foto ou vídeo; duas ou mais viram carrossel", () => {
    expect(L.postTypeFor([{ kind: "image" }])).toBe("imagem");
    expect(L.postTypeFor([{ kind: "video" }])).toBe("video");
    expect(L.postTypeFor([{ kind: "video" }, { kind: "image" }])).toBe("carrossel");
  });

  it("vídeo pode ter no máximo 60 segundos", () => {
    expect(L.validateVideo(60, 1000)).toBeNull();
    expect(L.validateVideo(61, 1000)).not.toBeNull();
  });

  it("vídeo pode ter no máximo 50 MB", () => {
    expect(L.validateVideo(10, 50 * 1024 * 1024)).toBeNull();
    expect(L.validateVideo(10, 50 * 1024 * 1024 + 1)).not.toBeNull();
  });

  it("publicação aceita no máximo 10 mídias", () => {
    const m = { id: "x", kind: "image" as const, src: "data:", width: 1, height: 1, alt: "a" };
    const media = Array.from({ length: 12 }, (_, i) => ({ ...m, id: `x${i}` }));
    const r = L.createPost(createSeedState(), "u1", { media, title: "t", description: "", category: "Grafite", credits: "c", tags: [] });
    expect(r.state.posts[0]!.media).toHaveLength(10);
  });

  it("recorte quadrado de foto 1000x500 pega o centro", () => {
    expect(L.cropRect(1000, 500, "1:1")).toEqual({ x: 250, y: 0, width: 500, height: 500 });
  });

  it("recorte 4:5 de foto 1000x1000 respeita a posição escolhida", () => {
    expect(L.cropRect(1000, 1000, "4:5", 0)).toEqual({ x: 0, y: 0, width: 800, height: 1000 });
    expect(L.cropRect(1000, 1000, "4:5", 1)).toEqual({ x: 200, y: 0, width: 800, height: 1000 });
  });

  it("dados salvos na versão antiga continuam funcionando", () => {
    const old = {
      version: 1,
      sessionUserId: "u1",
      posts: [{ id: "px", authorId: "u1", image: "data:abc", alt: "desc", title: "t", description: "", category: "Grafite", credits: "c", tags: [], likes: [], createdAt: "2026-01-01" }],
    };
    const s = L.migrateState(old, createSeedState())!;
    expect(s.version).toBe(4);
    const p = s.posts.find((x) => x.id === "px")!;
    expect(p.media[0]).toMatchObject({ kind: "image", src: "data:abc", alt: "desc" });
    expect(s.posts.some((x) => x.type === "video")).toBe(true);
  });

  describe("stories", () => {
    const img = { id: "m", kind: "image" as const, src: "data:x", width: 10, height: 10, alt: "x" };

    it("story some depois de 24 horas", () => {
      const r = L.createStory(createSeedState(), "u1", img, "oi");
      const st = r.state.stories.find((x) => x.id === r.id)!;
      const t = new Date(st.createdAt).getTime();
      expect(L.isStoryActive(st, t + 23 * 3600_000)).toBe(true);
      expect(L.isStoryActive(st, t + 24 * 3600_000)).toBe(false);
    });

    it("só aparece story de quem a pessoa segue (e o próprio)", () => {
      const s = createSeedState(); // u8 segue u1, u2, u4
      const authors = L.storyGroups(s, "u8").map((g) => g.user.id);
      expect(authors).toEqual(expect.arrayContaining(["u1", "u2", "u4"]));
      expect(authors).not.toContain("u5");
    });

    it("bloqueio esconde o story", () => {
      const s = L.toggleBlock(createSeedState(), "u8", "u1");
      expect(L.storyGroups(s, "u8").some((g) => g.user.id === "u1")).toBe(false);
    });

    it("mandar fogo conta uma vez e avisa o autor", () => {
      let s = L.reactToStory(createSeedState(), "u8", "s-seed-1");
      s = L.reactToStory(s, "u8", "s-seed-1");
      expect(s.stories.find((x) => x.id === "s-seed-1")!.reactions).toEqual(["u8"]);
      expect(s.notifications[0]).toMatchObject({ userId: "u1", actorId: "u8", type: "story" });
    });

    it("só o autor apaga o próprio story", () => {
      const s = createSeedState();
      expect(L.deleteStory(s, "u8", "s-seed-1").stories.length).toBe(s.stories.length);
      expect(L.deleteStory(s, "u1", "s-seed-1").stories.length).toBe(s.stories.length - 1);
    });

    it("dados da versão 2 ganham os stories de exemplo", () => {
      const seed = createSeedState();
      const old = { ...seed, version: 2, stories: undefined };
      const m = L.migrateState(old, seed)!;
      expect(m.version).toBe(4);
      expect(m.stories.length).toBe(seed.stories.length);
    });
  });
});
