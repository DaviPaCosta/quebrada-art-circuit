import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileRow } from "./auth";

/** Supabase falso: controla a sessão, os avisos de login e o resultado do signOut. */
const fake = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
  listener: null as null | ((event: string) => void),
  globalSignOutError: null as null | { message: string },
  localSignOuts: 0,
}));

vi.mock("./supabase", () => ({
  isSupabaseConfigured: () => true,
  APP_URL: () => "http://localhost",
  getSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: fake.session } }),
      onAuthStateChange: (cb: (event: string) => void) => {
        fake.listener = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signOut: async (opts?: { scope?: string }) => {
        if (opts?.scope === "local") {
          fake.localSignOuts++;
          fake.session = null;
          return { error: null };
        }
        if (fake.globalSignOutError) return { error: fake.globalSignOutError };
        fake.session = null;
        return { error: null };
      },
    },
  }),
}));

const row = (id: string): ProfileRow => ({
  id,
  username: `user${id}`,
  name: "Teste",
  birth_date: "2010-01-01",
  role: "aluno",
  is_moderator: false,
  bio: "",
  bairro: "",
  show_bairro: false,
  color: "spray",
  avatar_url: null,
  cover_url: null,
  styles: [],
  created_at: "2026-11-12T00:00:00Z",
});

const fetchOwnProfile = vi.fn<(id: string) => Promise<ProfileRow | null>>();
vi.mock("./auth", async (orig) => ({ ...(await orig<typeof import("./auth")>()), fetchOwnProfile: (id: string) => fetchOwnProfile(id) }));

const flush = () => new Promise((r) => setTimeout(r, 5));

async function freshStore() {
  vi.resetModules();
  const store = await import("./store");
  return store;
}

describe("sessão do Supabase no app", () => {
  beforeEach(() => {
    localStorage.clear();
    fake.session = null;
    fake.listener = null;
    fake.globalSignOutError = null;
    fake.localSignOuts = 0;
    fetchOwnProfile.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("falha passageira ao recarregar o perfil não derruba quem já está logado", async () => {
    fake.session = { user: { id: "a", email: "a@b.co" } };
    fetchOwnProfile.mockResolvedValueOnce(row("a"));
    const store = await freshStore();
    store.hydrateStore();
    await flush();
    expect(store.getAuthSnapshot()).toEqual({ status: "pronto", userId: "a" });

    fetchOwnProfile.mockRejectedValueOnce(new Error("Failed to fetch"));
    fake.listener?.("TOKEN_REFRESHED");
    await flush();
    expect(store.getAuthSnapshot()).toEqual({ status: "pronto", userId: "a" });
  });

  it("um carregamento antigo não loga de novo quem acabou de sair", async () => {
    fake.session = { user: { id: "a", email: "a@b.co" } };
    let releaseOld!: (r: ProfileRow) => void;
    fetchOwnProfile.mockImplementationOnce(() => new Promise((res) => (releaseOld = res)));
    const store = await freshStore();
    store.hydrateStore();
    await flush();

    fake.session = null;
    fake.listener?.("SIGNED_OUT");
    await flush();
    releaseOld(row("a"));
    await flush();
    expect(store.getAuthSnapshot().userId).toBeNull();
  });

  it("sair sem internet apaga a sessão do aparelho e sai da tela de erro", async () => {
    fake.session = { user: { id: "a", email: "a@b.co" } };
    fetchOwnProfile.mockResolvedValueOnce(null);
    const store = await freshStore();
    store.hydrateStore();
    await flush();
    expect(store.getAuthSnapshot().status).toBe("erro");

    fake.globalSignOutError = { message: "Failed to fetch" };
    await store.actions.signOut();
    expect(fake.localSignOuts).toBe(1);
    expect(store.getAuthSnapshot()).toEqual({ status: "pronto", userId: null });
  });
});
