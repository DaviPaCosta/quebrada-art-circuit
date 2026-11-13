import { useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { createEmptyState } from "./mock-data";
import * as L from "./logic";
import * as Auth from "./auth";
import * as Api from "./api/social";
import type { SocialSlice } from "./api/mappers";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { AppState, MediaItem, ReportTarget, Settings, User } from "./types";

const STORAGE_KEY = "vozes-do-muro:v1";
const REFRESH_MIN_MS = 60_000;

let state: AppState = createEmptyState();
let hydrated = false;
export type AuthStatus = "carregando" | "pronto" | "erro";
let authStatus: AuthStatus = "carregando";
let authListening = false;
let lastRefresh = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Só as preferências ficam no aparelho; o resto é cópia do banco. */
function persist() {
  if (typeof window === "undefined") return;
  try {
    const { settings, eventInterest, version } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...createEmptyState(), version, settings, eventInterest }));
  } catch {
    /* sem espaço: as preferências voltam ao padrão na próxima visita */
  }
}

function set(next: AppState) {
  if (next === state) return;
  state = next;
  persist();
  emit();
}

/** Estado atual (fora do React). */
export function getState(): AppState {
  return state;
}

/** Carrega as preferências salvas no aparelho (chamado uma vez após a página abrir). */
export function hydrateStore() {
  if (hydrated || typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const migrated = L.migrateState(JSON.parse(raw), createEmptyState());
      if (migrated) state = migrated;
    }
  } catch {
    /* dados corrompidos: começa do zero */
  }
  state = { ...state, sessionUserId: null };
  hydrated = true;
  persist();
  emit();
  startAuth();
}

function setAuthStatus(next: AuthStatus) {
  if (authStatus === next) return;
  authStatus = next;
  emit();
}

/** Junta o retrato do banco com o próprio perfil (que traz o e-mail). */
function applySnapshot(slice: SocialSlice, own: User) {
  const users = [own, ...slice.users.filter((u) => u.id !== own.id)];
  set({ ...state, ...slice, users, sessionUserId: own.id });
}

let loadSeq = 0;

/** Busca sessão, perfil e dados sociais. Só o carregamento mais recente vale. */
async function loadSession() {
  const seq = ++loadSeq;
  const stale = () => seq !== loadSeq;
  try {
    const { data } = await getSupabase().auth.getSession();
    if (stale()) return;
    const session = data.session;
    if (!session) {
      if (state.sessionUserId) set({ ...createEmptyState(), settings: state.settings, eventInterest: state.eventInterest });
      setAuthStatus("pronto");
      return;
    }
    const row = await Auth.fetchOwnProfile(session.user.id);
    if (stale()) return;
    const own = Auth.profileToUser(row, session.user.email ?? "");
    if (!own) return setAuthStatus("erro");
    try {
      const slice = await Api.fetchSnapshot(own.id);
      if (stale()) return;
      applySnapshot(slice, own);
      lastRefresh = Date.now();
    } catch (e) {
      if (stale()) return;
      // Entra mesmo assim; os dados aparecem na próxima tentativa.
      const users = [own, ...state.users.filter((u) => u.id !== own.id)];
      set({ ...state, users, sessionUserId: own.id });
      toast.error(e instanceof Error ? e.message : "Não conseguimos carregar o feed.");
    }
    setAuthStatus("pronto");
  } catch {
    if (stale()) return;
    // Já estava logado com este perfil: mantém o app funcionando e tenta de novo no próximo aviso.
    if (state.sessionUserId && authStatus === "pronto") return;
    setAuthStatus("erro");
  }
}

function startAuth() {
  if (!isSupabaseConfigured()) return setAuthStatus("pronto");
  if (authListening) return;
  authListening = true;
  getSupabase().auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY" && window.location.pathname !== "/nova-senha") {
      window.location.assign("/nova-senha");
      return;
    }
    if (event === "TOKEN_REFRESHED") return; // nada mudou para o app
    if (event === "SIGNED_IN" && !state.sessionUserId) setAuthStatus("carregando");
    // Não chamar o Supabase dentro do próprio aviso (pode travar): agenda para logo depois.
    window.setTimeout(() => void loadSession(), 0);
  });
  // Ao voltar para a aba, atualiza (no máximo 1x por minuto).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.sessionUserId && Date.now() - lastRefresh > REFRESH_MIN_MS) {
      void loadSession();
    }
  });
  void loadSession();
}

/** Situação atual da sessão (fora do React). */
export function getAuthSnapshot() {
  return { status: authStatus, userId: state.sessionUserId };
}

export function useAuthStatus(): AuthStatus {
  return useSyncExternalStore(
    subscribe,
    () => authStatus,
    () => "carregando" as AuthStatus,
  );
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function shallowEqual(a: unknown, b: unknown) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * Lê uma parte do estado. O componente só renderiza de novo quando
 * o valor selecionado muda (comparação rasa), não a cada ação no app.
 */
export function useAppState<T>(selector: (s: AppState) => T): T {
  const memo = useRef<{ s: AppState; sel: (s: AppState) => T; v: T } | null>(null);
  const getSnapshot = () => {
    const prev = memo.current;
    if (prev && prev.s === state && prev.sel === selector) return prev.v;
    let v = selector(state);
    if (prev && shallowEqual(prev.v, v)) v = prev.v;
    memo.current = { s: state, sel: selector, v };
    return v;
  };
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => hydrated,
    () => false,
  );
}

export function useCurrentUser(): User | null {
  return useAppState((s) => s.users.find((u) => u.id === s.sessionUserId) ?? null);
}

function me() {
  return state.sessionUserId;
}

/**
 * Aplica a mudança na tela na hora e grava no banco por trás.
 * Se o banco recusar, volta ao estado anterior e avisa.
 */
export async function optimistic(apply: (s: AppState) => AppState, remote: () => Promise<unknown>): Promise<boolean> {
  const before = state;
  const applied = apply(state);
  set(applied);
  try {
    await remote();
    return true;
  } catch (e) {
    // Desfaz se nada mais mudou no meio do caminho; senão, recarrega do banco para não perder outras mudanças.
    if (state === applied) set(before);
    else void loadSession();
    toast.error(e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");
    return false;
  }
}

/** @ citados num texto, já resolvidos para contas que existem. */
function mentions(text: string) {
  const id = me();
  return id ? L.mentionedUsers(state, id, text).map((u) => u.username) : [];
}

export const actions = {
  async signOut() {
    loadSeq++; // descarta carregamentos que ainda estejam a caminho
    if (isSupabaseConfigured()) await Auth.signOut();
    set({ ...createEmptyState(), settings: state.settings, eventInterest: state.eventInterest });
    setAuthStatus("pronto");
  },
  retryAuth() {
    setAuthStatus("carregando");
    void loadSession();
  },
  /** Recarrega tudo do banco (ex.: depois de publicar). */
  async refresh() {
    await loadSession();
  },
  async updateProfile(patch: L.ProfilePatch) {
    const id = me();
    if (!id) return { ok: false as const, error: "Entre na sua conta." };
    const local = L.updateProfile(state, id, patch);
    if (!local.ok) return local;
    const remote = await Auth.saveOwnProfile(id, patch);
    if (!remote.ok) return remote;
    try {
      if (patch.avatar !== undefined || patch.cover !== undefined) {
        await Api.setProfileImages({
          ...(patch.avatar !== undefined ? { avatar_url: patch.avatar || null } : {}),
          ...(patch.cover !== undefined ? { cover_url: patch.cover || null } : {}),
        });
      }
      if (patch.pinnedPostId !== undefined) await Api.setPinnedPost(patch.pinnedPostId || null);
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Não conseguimos salvar." };
    }
    // Reaplica sobre o estado atual (pode ter mudado enquanto o banco respondia).
    const next = L.updateProfile(state, id, patch);
    if (next.ok) set(next.state);
    return { ok: true as const };
  },
  async deleteAccount() {
    const id = me();
    if (!id) return { ok: false as const, error: "Entre na sua conta." };
    if (isSupabaseConfigured()) {
      const r = await Auth.deleteAccount();
      if (!r.ok) return r;
      await Auth.signOut();
    }
    set({ ...createEmptyState(), settings: state.settings, eventInterest: state.eventInterest });
    return { ok: true as const };
  },
  /** Cria o post no banco (mídias já enviadas) e coloca no topo do feed. */
  async createPost(data: L.NewPostData): Promise<string | null> {
    const id = me();
    if (!id) return null;
    try {
      const postId = await Api.insertPost({ ...data, type: L.postTypeFor(data.media) });
      const local = L.createPost(state, id, data);
      set({ ...local.state, posts: local.state.posts.map((p) => (p.id === local.id ? { ...p, id: postId } : p)) });
      void Api.notifyMentions(postId, null, mentions(`${data.description} ${data.credits}`));
      return postId;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não conseguimos publicar.");
      return null;
    }
  },
  async deletePost(postId: string) {
    const id = me();
    await optimistic(
      (s) => ({
        ...s,
        posts: s.posts.filter((p) => !(p.id === postId && p.authorId === id)),
        comments: s.comments.filter((c) => c.postId !== postId),
      }),
      () => Api.deletePost(postId),
    );
  },
  async createStory(media: MediaItem, caption: string): Promise<string | null> {
    const id = me();
    if (!id) return null;
    try {
      const storyId = await Api.insertStory(media, caption);
      const local = L.createStory(state, id, media, caption);
      set({ ...local.state, stories: local.state.stories.map((st) => (st.id === local.id ? { ...st, id: storyId } : st)) });
      return storyId;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não conseguimos publicar o story.");
      return null;
    }
  },
  async markStoryViewed(storyId: string) {
    const id = me();
    const story = state.stories.find((st) => st.id === storyId);
    if (!id || !story || story.viewers.includes(id) || story.authorId === id) return;
    set(L.markStoryViewed(state, id, storyId));
    await Api.markStoryViewed(storyId).catch(() => {});
  },
  async reactToStory(storyId: string) {
    const id = me();
    if (id) await optimistic((s) => L.reactToStory(s, id, storyId), () => Api.reactToStory(storyId));
  },
  async deleteStory(storyId: string) {
    const id = me();
    if (id) await optimistic((s) => L.deleteStory(s, id, storyId), () => Api.deleteStory(storyId));
  },
  async toggleLike(postId: string) {
    const id = me();
    if (!id) return;
    const on = !state.posts.find((p) => p.id === postId)?.likes.includes(id);
    await optimistic((s) => L.toggleLike(s, id, postId), () => Api.setLike(postId, on));
  },
  async addComment(postId: string, text: string, parentId?: string) {
    const id = me();
    if (!id) return;
    try {
      const commentId = await Api.addComment(postId, text.trim(), parentId);
      const next = L.addComment(state, id, postId, text, parentId);
      const tempId = next.comments.at(-1)?.id;
      set({ ...next, comments: next.comments.map((c) => (c.id === tempId ? { ...c, id: commentId } : c)) });
      void Api.notifyMentions(postId, commentId, mentions(text));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não conseguimos enviar o comentário.");
    }
  },
  async toggleCommentLike(commentId: string) {
    const id = me();
    if (!id) return;
    const on = !state.comments.find((c) => c.id === commentId)?.likes.includes(id);
    await optimistic((s) => L.toggleCommentLike(s, id, commentId), () => Api.setCommentLike(commentId, on));
  },
  async deleteComment(commentId: string) {
    const id = me();
    const c = state.comments.find((x) => x.id === commentId);
    const post = c && state.posts.find((p) => p.id === c.postId);
    const mine = c && (c.authorId === id || post?.authorId === id || state.users.find((u) => u.id === id)?.isModerator);
    if (!c || !mine) return;
    await optimistic(
      (s) => ({ ...s, comments: s.comments.filter((x) => x.id !== commentId && x.parentId !== commentId) }),
      () => Api.deleteComment(commentId),
    );
  },
  async toggleSave(postId: string) {
    const id = me();
    if (!id) return;
    const on = !(state.saved[id] ?? []).includes(postId);
    await optimistic((s) => L.toggleSave(s, id, postId), () => Api.setSave(postId, on));
  },
  async toggleFollow(targetId: string) {
    const id = me();
    if (!id) return;
    const on = !(state.follows[id] ?? []).includes(targetId);
    await optimistic((s) => L.toggleFollow(s, id, targetId), () => Api.setFollow(targetId, on));
  },
  async toggleBlock(targetId: string) {
    const id = me();
    if (!id) return;
    const on = !(state.blocks[id] ?? []).includes(targetId);
    await optimistic((s) => L.toggleBlock(s, id, targetId), () => Api.setBlock(targetId, on));
  },
  async report(input: { targetType: ReportTarget; targetId: string; reason: string; details: string }) {
    const id = me();
    if (id) await optimistic((s) => L.report(s, id, input), () => Api.insertReport(input));
  },
  async resolveReport(reportId: string, action: "remover" | "arquivar") {
    const id = me();
    const report = state.reports.find((r) => r.id === reportId);
    if (!id || !report) return;
    await optimistic((s) => L.resolveReport(s, id, reportId, action), () => Api.resolveReport(report, action));
  },
  async markNotificationsRead() {
    const id = me();
    if (!id) return;
    if (!state.notifications.some((n) => n.userId === id && !n.read)) return;
    await optimistic(
      (s) => ({ ...s, notifications: s.notifications.map((n) => (n.userId === id ? { ...n, read: true } : n)) }),
      () => Api.markNotificationsRead(),
    );
  },
  toggleEventInterest(eventId: string) {
    const id = me();
    if (!id) return;
    const list = state.eventInterest[id] ?? [];
    set({
      ...state,
      eventInterest: {
        ...state.eventInterest,
        [id]: list.includes(eventId) ? list.filter((e) => e !== eventId) : [...list, eventId],
      },
    });
  },
  updateSettings(patch: Partial<Settings>) {
    set({ ...state, settings: { ...state.settings, ...patch } });
  },
};
