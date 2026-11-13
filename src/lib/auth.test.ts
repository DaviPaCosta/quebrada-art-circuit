import { describe, expect, it } from "vitest";
import { otpFromUrl, profileToUser, signUpOutcome, type ProfileRow } from "./auth";

describe("perfil do banco", () => {
  it("converte a linha do banco em usuário do app", () => {
    const row: ProfileRow = { id: "x", username: "ana", name: "Ana", birth_date: "2010-01-01", role: "aluno", is_moderator: false, bio: "", bairro: "Capão", show_bairro: true, color: "lime", avatar_url: null, cover_url: null, styles: ["Rap"], created_at: "2026-11-12T00:00:00Z" };
    expect(profileToUser(row, "a@b.co")).toMatchObject({ id: "x", username: "ana", role: "aluno", isModerator: false, email: "a@b.co", showBairro: true, styles: ["Rap"] });
  });
  it("sem linha no banco não há usuário", () => {
    expect(profileToUser(null, "a@b.co")).toBeNull();
  });
});

describe("cadastro e links do e-mail", () => {
  it("e-mail já cadastrado não finge que deu certo", () => {
    expect(signUpOutcome({ user: { identities: [] } })).toEqual({ ok: false, error: "Já existe uma conta com esse e-mail." });
    expect(signUpOutcome({ user: { identities: [{ id: "1" }] } })).toEqual({ ok: true });
  });
  it("lê o token do link do e-mail", () => {
    expect(otpFromUrl("?token_hash=abc&type=recovery")).toEqual({ token_hash: "abc", type: "recovery" });
    expect(otpFromUrl("?token_hash=abc&type=email")).toEqual({ token_hash: "abc", type: "email" });
    expect(otpFromUrl("?token_hash=abc&type=hack")).toBeNull();
    expect(otpFromUrl("")).toBeNull();
  });
});
