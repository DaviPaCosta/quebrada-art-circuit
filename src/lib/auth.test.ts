import { describe, expect, it } from "vitest";
import { profileToUser, type ProfileRow } from "./auth";

describe("perfil do banco", () => {
  it("converte a linha do banco em usuário do app", () => {
    const row: ProfileRow = { id: "x", username: "ana", name: "Ana", birth_date: "2010-01-01", role: "aluno", is_moderator: false, bio: "", bairro: "Capão", show_bairro: true, color: "lime", avatar_url: null, cover_url: null, styles: ["Rap"], created_at: "2026-11-12T00:00:00Z" };
    expect(profileToUser(row, "a@b.co")).toMatchObject({ id: "x", username: "ana", role: "aluno", isModerator: false, email: "a@b.co", showBairro: true, styles: ["Rap"] });
  });
  it("sem linha no banco não há usuário", () => {
    expect(profileToUser(null, "a@b.co")).toBeNull();
  });
});
