import { friendlyAuthError } from "./auth-errors";
import { ageOn, normalizeUsername, roleForAge, type AccountRole, type ProfilePatch, type SignUpInput } from "./logic";
import { APP_URL, getSupabase } from "./supabase";
import type { User } from "./types";

export type AuthResult = { ok: true } | { ok: false; error: string };

export interface ProfileRow {
  id: string;
  username: string;
  name: string;
  birth_date: string;
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
}

/** Linha do banco → usuário do app (só para a própria conta, que pode ver o e-mail). */
export function profileToUser(row: ProfileRow | null, email: string): User | null {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email,
    avatar: row.avatar_url ?? undefined,
    cover: row.cover_url ?? undefined,
    color: row.color,
    bio: row.bio,
    bairro: row.bairro,
    showBairro: row.show_bairro,
    styles: row.styles as User["styles"],
    role: row.role,
    isModerator: row.is_moderator,
    createdAt: row.created_at,
  };
}

async function run(fn: () => Promise<{ error: { message: string } | null }>): Promise<AuthResult> {
  try {
    const { error } = await fn();
    return error ? { ok: false, error: friendlyAuthError(error.message) } : { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyAuthError(e instanceof Error ? e.message : String(e)) };
  }
}

/** Com confirmação de e-mail ligada, o Supabase não dá erro para e-mail repetido: devolve um usuário sem identidades. */
export function signUpOutcome(data: { user: { identities?: unknown[] | null } | null } | null): AuthResult {
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
    return { ok: false, error: "Já existe uma conta com esse e-mail." };
  return { ok: true };
}

export async function signUp(input: SignUpInput): Promise<AuthResult> {
  const age = ageOn(input.birthDate, new Date());
  let outcome: AuthResult = { ok: true };
  const r = await run(async () => {
    const { data, error } = await getSupabase().auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        emailRedirectTo: `${APP_URL()}/auth/callback`,
        data: {
          username: normalizeUsername(input.username),
          name: input.name.trim(),
          birth_date: input.birthDate,
          role_choice: roleForAge(age, input.roleChoice),
        },
      },
    });
    if (!error) outcome = signUpOutcome(data);
    return { error };
  });
  return r.ok ? outcome : r;
}

export type OtpParams = { token_hash: string; type: "email" | "recovery" };

/** Token do link do e-mail (funciona em qualquer aparelho, diferente do código PKCE). */
export function otpFromUrl(search: string): OtpParams | null {
  const p = new URLSearchParams(search);
  const token_hash = p.get("token_hash");
  const type = p.get("type");
  if (!token_hash || (type !== "email" && type !== "recovery")) return null;
  return { token_hash, type };
}

export function verifyEmailLink(otp: OtpParams): Promise<AuthResult> {
  return run(() => getSupabase().auth.verifyOtp(otp));
}

export function signIn(email: string, password: string): Promise<AuthResult> {
  return run(() => getSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password }));
}

export function resendConfirmation(email: string): Promise<AuthResult> {
  return run(() =>
    getSupabase().auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${APP_URL()}/auth/callback` },
    }),
  );
}

export function requestPasswordReset(email: string): Promise<AuthResult> {
  return run(() =>
    getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${APP_URL()}/nova-senha` }),
  );
}

export function updatePassword(password: string): Promise<AuthResult> {
  return run(() => getSupabase().auth.updateUser({ password }));
}

/** Sai em todos os aparelhos; sem internet, ao menos apaga a sessão deste aparelho. */
export async function signOut(): Promise<AuthResult> {
  const r = await run(() => getSupabase().auth.signOut());
  if (!r.ok) await run(() => getSupabase().auth.signOut({ scope: "local" }));
  return r;
}

/** Apaga a conta no servidor (Edge Function delete-account); o perfil cai junto. */
export function deleteAccount(): Promise<AuthResult> {
  return run(async () => {
    const { error } = await getSupabase().functions.invoke("delete-account", { method: "POST" });
    return { error: error ? { message: error.message } : null };
  });
}

export async function usernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc("username_available", { p_username: normalizeUsername(username) });
  return !error && data === true;
}

export async function fetchOwnProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await getSupabase().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProfileRow | null) ?? null;
}

/** Grava no banco só os campos de texto do perfil. Foto, capa e destaque continuam no aparelho até a Etapa 2. */
export function saveOwnProfile(userId: string, patch: ProfilePatch): Promise<AuthResult> {
  const row: Partial<ProfileRow> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.username !== undefined) row.username = normalizeUsername(patch.username);
  if (patch.bio !== undefined) row.bio = patch.bio;
  if (patch.bairro !== undefined) row.bairro = patch.bairro;
  if (patch.showBairro !== undefined) row.show_bairro = patch.showBairro;
  if (patch.color !== undefined) row.color = patch.color;
  if (patch.styles !== undefined) row.styles = patch.styles;
  if (Object.keys(row).length === 0) return Promise.resolve({ ok: true });
  return run(async () => await getSupabase().from("profiles").update(row).eq("id", userId));
}
