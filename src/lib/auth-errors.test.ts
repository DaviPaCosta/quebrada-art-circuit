import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "./auth-errors";

describe("mensagens de erro de conta", () => {
  it.each([
    ["Database error saving new user", "Esse nome de usuário já está em uso ou é inválido."],
    ["User already registered", "Já existe uma conta com esse e-mail."],
    ["Email not confirmed", "Confirme seu e-mail antes de entrar. Verifique a caixa de entrada e o spam."],
    ["Invalid login credentials", "E-mail ou senha incorretos."],
    ["Failed to fetch", "Sem conexão com a internet. Tente de novo."],
    ["Email link is invalid or has expired", "O link expirou. Peça um novo."],
    ['duplicate key value violates unique constraint "profiles_username_key"', "Esse nome de usuário já está em uso."],
    ["qualquer outra coisa", "Algo deu errado. Tente de novo em instantes."],
  ])("traduz %s", (msg, pt) => expect(friendlyAuthError(msg)).toBe(pt));
});
