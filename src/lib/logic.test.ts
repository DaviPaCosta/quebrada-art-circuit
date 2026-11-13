import { describe, expect, it } from "vitest";
import { createEmptyState, createSeedState } from "./mock-data";
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

  });
});

describe("idade e papel", () => {
  const hoje = new Date(2026, 10, 12); // 12/11/2026 local
  it("conta a idade pelo calendário, sem fuso", () => {
    expect(L.ageOn("2013-11-12", hoje)).toBe(13);
    expect(L.ageOn("2013-11-13", hoje)).toBe(12);
    expect(L.ageOn("2006-11-12", hoje)).toBe(20);
  });
  it("define o papel nos limites", () => {
    expect(L.roleForAge(19)).toBe("aluno");
    expect(L.roleForAge(20, "professor")).toBe("professor");
    expect(L.roleForAge(30)).toBe("aluno");
    expect(L.roleForAge(30, "professor")).toBe("professor");
    expect(L.roleForAge(31, "aluno")).toBe("professor");
    expect(L.roleForAge(19, "professor")).toBe("aluno");
  });
  it("só pede escolha entre 20 e 30", () => {
    expect([19, 20, 30, 31].map(L.needsRoleChoice)).toEqual([false, true, true, false]);
  });
  it("valida o cadastro", () => {
    const ok = { name: "Ana", username: "ana.rima", email: "a@b.co", password: "12345678", birthDate: "2010-01-01", acceptedRules: true };
    expect(L.validateSignUp(ok, hoje)).toBeNull();
    expect(L.validateSignUp({ ...ok, birthDate: "2014-01-01" }, hoje)).toBe("Você precisa ter pelo menos 13 anos para criar uma conta.");
    expect(L.validateSignUp({ ...ok, password: "1234567" }, hoje)).toBe("A senha precisa ter pelo menos 8 caracteres.");
    expect(L.validateSignUp({ ...ok, acceptedRules: false }, hoje)).toBe("Você precisa aceitar as regras de convivência.");
    expect(L.validateSignUp({ ...ok, birthDate: "" }, hoje)).toBe("Informe sua data de nascimento.");
    expect(L.validateSignUp({ ...ok, birthDate: "2999-01-01" }, hoje)).toBe("Data de nascimento inválida.");
  });
});

describe("migração v6", () => {
  it("dados antigos do navegador viram estado limpo, mantendo configurações", () => {
    const seed = createSeedState();
    const settings = { fontSize: 20, highContrast: true, reduceMotion: false };
    for (const version of [1, 2, 3, 4, 5]) {
      const old = { ...seed, version, settings, eventInterest: { u1: ["e1"] } };
      const s = L.migrateState(old, createEmptyState())!;
      expect(s.version).toBe(6);
      expect(s).toMatchObject({ posts: [], users: [], stories: [], comments: [], notifications: [], reports: [], follows: {}, saved: {}, blocks: {} });
      expect(s.settings).toEqual(settings);
      expect(s.eventInterest).toEqual({ u1: ["e1"] });
    }
  });
  it("dados já na versão 6 continuam", () => {
    const empty = createEmptyState();
    const s = L.migrateState({ ...empty, settings: { ...empty.settings, fontSize: 18 } }, createEmptyState())!;
    expect(s.settings.fontSize).toBe(18);
  });
});

describe("destaques e vídeos", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");
  const base = createSeedState();
  const prof = { ...base.users[0]!, id: "prof", role: "professor" as const };
  const aluno = { ...base.users[1]!, id: "aluno", role: "aluno" as const };
  const post = (id: string, authorId: string, daysAgo: number, extra = {}) => ({ ...base.posts[0]!, id, authorId, createdAt: new Date(now - daysAgo * 864e5).toISOString(), ...extra });
  const s = { users: [prof, aluno], blocks: {}, posts: [post("a", "prof", 1), post("b", "aluno", 1), post("c", "prof", 8), post("d", "prof", 2, { removed: true }), post("e", "prof", 0)] };
  it("destaca só professores dos últimos 7 dias, mais novo primeiro", () => {
    expect(L.highlightPosts(s, "aluno", now).map((p) => p.id)).toEqual(["e", "a"]);
  });
  it("não destaca quem está bloqueado", () => {
    expect(L.highlightPosts({ ...s, blocks: { aluno: ["prof"] } }, "aluno", now)).toEqual([]);
  });
  it("a página de destaques pode olhar mais dias e mais posts", () => {
    expect(L.highlightPosts(s, "aluno", now, { days: 30 }).map((p) => p.id)).toEqual(["e", "a", "c"]);
    const many = { ...s, posts: Array.from({ length: 70 }, (_, i) => post(`p${i}`, "prof", i * 0.1)) };
    expect(L.highlightPosts(many, "aluno", now, { days: 30, max: 60 })).toHaveLength(60);
  });
  it("limita a 10", () => {
    const many = { ...s, posts: Array.from({ length: 12 }, (_, i) => post(`p${i}`, "prof", i * 0.1)) };
    expect(L.highlightPosts(many, "aluno", now)).toHaveLength(10);
  });
  it("decide como tratar o vídeo", () => {
    expect(L.videoPlan({ canCompress: true }, 90e6, 50)).toEqual({ action: "comprimir" });
    expect(L.videoPlan({ canCompress: false }, 10e6, 20)).toEqual({ action: "enviar" });
    expect(L.videoPlan({ canCompress: false }, 20e6, 20)).toEqual({ action: "recusar", error: "Esse vídeo é grande demais para este aparelho. Grave um vídeo mais curto." });
    expect(L.videoPlan({ canCompress: true }, 10e6, 61)).toEqual({ action: "recusar", error: "O vídeo pode ter no máximo 60 segundos." });
  });
});

describe("respostas", () => {
  it("resposta a uma resposta vai para o comentário raiz", () => {
    const comments = [
      { id: "c1", postId: "p", authorId: "a", text: "raiz", likes: [], createdAt: "" },
      { id: "c2", postId: "p", authorId: "b", text: "resp", parentId: "c1", likes: [], createdAt: "" },
    ];
    expect(L.rootCommentId(comments, "c2")).toBe("c1");
    expect(L.rootCommentId(comments, "c1")).toBe("c1");
    expect(L.rootCommentId(comments, undefined)).toBeUndefined();
  });
});

describe("arquivar e editar posts", () => {
  const s0 = createSeedState();
  const p = s0.posts[0]!;
  it("arquivado some do feed e vai para os arquivados do autor", () => {
    const s = L.setArchived(s0, p.authorId, p.id, true);
    expect(L.visiblePosts(s, "u8").some((x) => x.id === p.id)).toBe(false);
    expect(L.archivedPosts(s, p.authorId).map((x) => x.id)).toEqual([p.id]);
    expect(L.archivedPosts(s, "u8")).toEqual([]);
    expect(L.visiblePosts(L.setArchived(s, p.authorId, p.id, false), "u8").some((x) => x.id === p.id)).toBe(true);
  });
  it("só o autor arquiva", () => {
    expect(L.setArchived(s0, "outra-pessoa", p.id, true)).toBe(s0);
  });
  it("edita a legenda com validação", () => {
    const r = L.editPostText(s0, p.authorId, p.id, { title: " Novo título ", description: "Nova", tags: ["a"] });
    expect(r.ok && r.state.posts.find((x) => x.id === p.id)).toMatchObject({ title: "Novo título", description: "Nova", tags: ["a"] });
    expect(L.editPostText(s0, p.authorId, p.id, { title: "  ", description: "", tags: [] })).toEqual({ ok: false, error: "Dê um título para a obra." });
    expect(L.editPostText(s0, "outra-pessoa", p.id, { title: "x", description: "", tags: [] })).toEqual({ ok: false, error: "Só quem publicou pode editar." });
  });
});
