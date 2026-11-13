/** Traduz as mensagens do Supabase Auth para o português do app. */
const MESSAGES: [match: string, text: string][] = [
  ["database error saving new user", "Esse nome de usuário já está em uso ou é inválido."],
  ["user already registered", "Já existe uma conta com esse e-mail."],
  ["email not confirmed", "Confirme seu e-mail antes de entrar. Verifique a caixa de entrada e o spam."],
  ["invalid login credentials", "E-mail ou senha incorretos."],
  ["failed to fetch", "Sem conexão com a internet. Tente de novo."],
  ["invalid or has expired", "O link expirou. Peça um novo."],
];

export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  return MESSAGES.find(([match]) => m.includes(match))?.[1] ?? "Algo deu errado. Tente de novo em instantes.";
}
