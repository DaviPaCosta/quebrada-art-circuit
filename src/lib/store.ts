import { useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { createSeedState } from "./mock-data";
import * as L from "./logic";
import * as Auth from "./auth";
import { deleteMedia } from "./media-db";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { AppState, MediaItem, ReportTarget, Settings, User } from "./types";

const STORAGE_KEY = "vozes-do-muro:v1";

let state: AppState = createSeedState();
let hydrated = false;
export type AuthStatus = "carregando" | "pronto" | "erro";
let authStatus: AuthStatus = "carregando";
let authListening = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    toast.error("Armazenamento do aparelho cheio. Tente uma imagem menor ou exclua publicações.");
  }
}

function set(next: AppState) {
  if (next === state) return;
  state = next;
  persist();
  emit();
}

/** Carrega os dados salvos no aparelho (chamado uma vez após a página abrir). */
export function hydrateStore() {
  if (hydrated || typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const migrated = L.migrateState(JSON.parse(raw), createSeedState());
      if (migrated) state = migrated;
    }
    // Apaga do aparelho os stories que já venceram.
    const expired = L.expiredStories(state);
    if (expired.length) {
      void deleteMedia(L.storyMediaRefs(expired));
      const ids = new Set(expired.map((st) => st.id));
      state = { ...state, stories: state.stories.filter((st) => !ids.has(st.id)) };
    }
  } catch {
    /* dados corrompidos: começa do zero */
  }
  // A sessão agora vem do Supabase; até ele responder, ninguém está logado.
  state = { ...state, sessionUserId: null };
  hydrated = true;
  emit();
  startAuth();
}

function setAuthStatus(next: AuthStatus) {
  if (authStatus === next) return;
  authStatus = next;
  emit();
}

/** Coloca o perfil vindo do banco no estado local, mantendo foto/capa/destaque guardados no aparelho. */
function applyOwnProfile(user: User) {
  const local = state.users.find((u) => u.id === user.id);
  const merged: User = {
    ...user,
    avatar: user.avatar ?? local?.avatar,
    cover: user.cover ?? local?.cover,
    pinnedPostId: local?.pinnedPostId,
  };
  const users = local ? state.users.map((u) => (u.id === user.id ? merged : u)) : [...state.users, merged];
  set({ ...state, users, sessionUserId: user.id });
}

async function loadSession() {
  try {
    const { data } = await getSupabase().auth.getSession();
    const session = data.session;
    if (!session) {
      if (state.sessionUserId) set({ ...state, sessionUserId: null });
      setAuthStatus("pronto");
      return;
    }
    const user = Auth.profileToUser(await Auth.fetchOwnProfile(session.user.id), session.user.email ?? "");
    if (!user) return setAuthStatus("erro");
    applyOwnProfile(user);
    setAuthStatus("pronto");
  } catch {
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
    // Não chamar o Supabase dentro do próprio aviso (pode travar): agenda para logo depois.
    window.setTimeout(() => void loadSession(), 0);
  });
  void loadSession();
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

export const actions = {
  signUp(_input: { name: string; username: string; email: string; password: string }) {
    // Substituído pelo Supabase Auth (auth.ts) na próxima etapa do plano.
    return { ok: false as const, error: "Cadastro em atualização." };
  },
  signIn(_identifier: string, _password: string) {
    return { ok: false as const, error: "Login em atualização." };
  },
  async signOut() {
    if (isSupabaseConfigured()) await Auth.signOut();
    set({ ...state, sessionUserId: null });
  },
  retryAuth() {
    setAuthStatus("carregando");
    void loadSession();
  },
  async updateProfile(patch: L.ProfilePatch) {
    const id = me();
    if (!id) return { ok: false as const, error: "Entre na sua conta." };
    const local = L.updateProfile(state, id, patch);
    if (!local.ok) return local;
    const remote = await Auth.saveOwnProfile(id, patch);
    if (!remote.ok) return remote;
    // Reaplica sobre o estado atual (pode ter mudado enquanto o banco respondia).
    const next = L.updateProfile(state, id, patch);
    if (next.ok) set(next.state);
    return { ok: true as const };
  },
  deleteAccount() {
    const id = me();
    if (!id) return;
    void deleteMedia(L.storedMediaRefs(state.posts.filter((p) => p.authorId === id)));
    void deleteMedia(L.storyMediaRefs(state.stories.filter((st) => st.authorId === id)));
    set(L.deleteAccount(state, id));
  },
  createPost(data: L.NewPostData) {
    const id = me();
    if (!id) return null;
    const r = L.createPost(state, id, data);
    set(r.state);
    simulateReaction(r.id, id);
    return r.id;
  },
  deletePost(postId: string) {
    const id = me();
    void deleteMedia(L.storedMediaRefs(state.posts.filter((p) => p.id === postId && p.authorId === id)));
    set({
      ...state,
      posts: state.posts.filter((p) => !(p.id === postId && p.authorId === id)),
      comments: state.comments.filter((c) => c.postId !== postId),
    });
  },
  createStory(media: MediaItem, caption: string) {
    const id = me();
    if (!id) return null;
    const r = L.createStory(state, id, media, caption);
    set(r.state);
    return r.id;
  },
  markStoryViewed(storyId: string) {
    const id = me();
    if (id) set(L.markStoryViewed(state, id, storyId));
  },
  reactToStory(storyId: string) {
    const id = me();
    if (id) set(L.reactToStory(state, id, storyId));
  },
  deleteStory(storyId: string) {
    const id = me();
    if (!id) return;
    void deleteMedia(L.storyMediaRefs(state.stories.filter((st) => st.id === storyId && st.authorId === id)));
    set(L.deleteStory(state, id, storyId));
  },
  toggleLike(postId: string) {
    const id = me();
    if (id) set(L.toggleLike(state, id, postId));
  },
  addComment(postId: string, text: string, parentId?: string) {
    const id = me();
    if (id) set(L.addComment(state, id, postId, text, parentId));
  },
  toggleCommentLike(commentId: string) {
    const id = me();
    if (id) set(L.toggleCommentLike(state, id, commentId));
  },
  deleteComment(commentId: string) {
    const id = me();
    const c = state.comments.find((x) => x.id === commentId);
    const post = c && state.posts.find((p) => p.id === c.postId);
    if (!c || (c.authorId !== id && post?.authorId !== id)) return;
    set({ ...state, comments: state.comments.filter((x) => x.id !== commentId && x.parentId !== commentId) });
  },
  toggleSave(postId: string) {
    const id = me();
    if (id) set(L.toggleSave(state, id, postId));
  },
  toggleFollow(targetId: string) {
    const id = me();
    if (id) set(L.toggleFollow(state, id, targetId));
  },
  toggleBlock(targetId: string) {
    const id = me();
    if (id) set(L.toggleBlock(state, id, targetId));
  },
  report(input: { targetType: ReportTarget; targetId: string; reason: string; details: string }) {
    const id = me();
    if (id) set(L.report(state, id, input));
  },
  resolveReport(reportId: string, action: "remover" | "arquivar") {
    const id = me();
    if (id) set(L.resolveReport(state, id, reportId, action));
  },
  markNotificationsRead() {
    const id = me();
    if (!id) return;
    if (!state.notifications.some((n) => n.userId === id && !n.read)) return;
    set({
      ...state,
      notifications: state.notifications.map((n) => (n.userId === id ? { ...n, read: true } : n)),
    });
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

const REACTIONS = [
  "Que trampo bonito! 🔥",
  "Isso merece estar num muro gigante.",
  "Respeito demais pela autoria e pelo cuidado.",
  "Salvei pra mostrar pra turma!",
  "Arte que fala da gente. 🧡",
];

/** Protótipo: simula a comunidade reagindo à sua nova publicação. */
function simulateReaction(postId: string, authorId: string) {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    const others = state.users.filter((u) => u.id !== authorId && !L.isBlockedBetween(state, u.id, authorId));
    if (!others.length || !state.posts.some((p) => p.id === postId)) return;
    const fan = others[Math.floor(Math.random() * others.length)]!;
    let next = L.toggleLike(state, fan.id, postId);
    next = L.addComment(next, fan.id, postId, REACTIONS[Math.floor(Math.random() * REACTIONS.length)]!);
    set(next);
    toast(`@${fan.username} curtiu e comentou sua publicação`);
  }, 4000);
}
