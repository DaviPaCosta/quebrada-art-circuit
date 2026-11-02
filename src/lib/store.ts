import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { createSeedState } from "./mock-data";
import * as L from "./logic";
import type { AppState, Category, ReportTarget, Settings, User } from "./types";

const STORAGE_KEY = "vozes-do-muro:v1";

let state: AppState = createSeedState();
let hydrated = false;
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
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === 1) state = { ...createSeedState(), ...parsed };
    }
  } catch {
    /* dados corrompidos: começa do zero */
  }
  hydrated = true;
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getState = () => state;
const getServerState = () => state;

export function useAppState<T>(selector: (s: AppState) => T): T {
  return selector(useSyncExternalStore(subscribe, getState, getServerState));
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
  signUp(input: { name: string; username: string; email: string; password: string }) {
    const r = L.signUp(state, input);
    if (r.ok) set(r.state);
    return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
  },
  signIn(identifier: string, password: string) {
    const r = L.signIn(state, identifier, password);
    if (r.ok) set(r.state);
    return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
  },
  signOut() {
    set({ ...state, sessionUserId: null });
  },
  emailExists(email: string) {
    return state.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  },
  updateProfile(patch: Partial<Pick<User, "name" | "username" | "bio" | "bairro" | "showBairro" | "styles" | "avatar">>) {
    const id = me();
    if (!id) return { ok: false as const, error: "Entre na sua conta." };
    if (patch.username !== undefined) {
      const u = L.normalizeUsername(patch.username);
      if (!L.isValidUsername(u))
        return { ok: false as const, error: "Usuário deve ter 3 a 20 caracteres: letras, números, ponto ou _." };
      if (state.users.some((x) => x.username === u && x.id !== id))
        return { ok: false as const, error: "Esse nome de usuário já está em uso." };
      patch.username = u;
    }
    set({ ...state, users: state.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) });
    return { ok: true as const };
  },
  deleteAccount() {
    const id = me();
    if (id) set(L.deleteAccount(state, id));
  },
  createPost(data: { image: string; alt: string; title: string; description: string; category: Category; credits: string; tags: string[] }) {
    const id = me();
    if (!id) return null;
    const r = L.createPost(state, id, data);
    set(r.state);
    simulateReaction(r.id, id);
    return r.id;
  },
  deletePost(postId: string) {
    const id = me();
    set({
      ...state,
      posts: state.posts.filter((p) => !(p.id === postId && p.authorId === id)),
      comments: state.comments.filter((c) => c.postId !== postId),
    });
  },
  toggleLike(postId: string) {
    const id = me();
    if (id) set(L.toggleLike(state, id, postId));
  },
  addComment(postId: string, text: string) {
    const id = me();
    if (id) set(L.addComment(state, id, postId, text));
  },
  deleteComment(commentId: string) {
    const id = me();
    const c = state.comments.find((x) => x.id === commentId);
    const post = c && state.posts.find((p) => p.id === c.postId);
    if (!c || (c.authorId !== id && post?.authorId !== id)) return;
    set({ ...state, comments: state.comments.filter((x) => x.id !== commentId) });
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
  resetDemo() {
    set(createSeedState());
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
