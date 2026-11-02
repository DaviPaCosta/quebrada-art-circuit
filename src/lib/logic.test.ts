import { describe, expect, it } from "vitest";
import { createSeedState } from "./mock-data";
import * as L from "./logic";

describe("regras da rede", () => {
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
});
