import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** O app só fala com o servidor quando as variáveis do Supabase existem. */
export function isSupabaseConfigured() {
  return Boolean(url && anonKey);
}

/** Cliente único, criado na primeira chamada e só no navegador. */
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) throw new Error("Supabase não configurado");
  if (typeof window === "undefined") throw new Error("Supabase só roda no navegador");
  client ??= createClient(url, anonKey, {
    auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
  });
  return client;
}

/** Endereço do app, usado nos links dos e-mails. */
export function APP_URL() {
  return window.location.origin;
}
