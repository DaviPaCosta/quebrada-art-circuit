import { useEffect, useSyncExternalStore } from "react";
import * as Chat from "./api/chat";
import { totalUnread, type ConversationSummary } from "./chat";
import { isSupabaseConfigured } from "./supabase";

/** Lista de conversas compartilhada (barra de navegação e tela de Mensagens). */
let conversations: ConversationSummary[] = [];
let loadedFor: string | null = null;
let stopRealtime: (() => void) | null = null;
let timer: number | undefined;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export async function refreshConversations() {
  if (!isSupabaseConfigured() || !loadedFor) return;
  const forUser = loadedFor;
  try {
    const list = await Chat.myConversations();
    // Trocou de conta enquanto carregava (computador da escola): descarta.
    if (forUser !== loadedFor) return;
    conversations = list;
    emit();
  } catch {
    /* sem internet: mantém a lista anterior */
  }
}

/** Atualiza logo depois de uma mensagem nova (junta várias seguidas). */
function refreshSoon() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void refreshConversations(), 400);
}

function start(userId: string) {
  if (loadedFor === userId) return;
  stopRealtime?.();
  loadedFor = userId;
  conversations = [];
  void refreshConversations();
  stopRealtime = Chat.subscribeChat(`lista-${userId}`, { onMessage: refreshSoon, onRead: refreshSoon });
}

function stop() {
  stopRealtime?.();
  stopRealtime = null;
  loadedFor = null;
  conversations = [];
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useConversations(userId: string | null) {
  useEffect(() => {
    if (userId) start(userId);
    else stop();
  }, [userId]);
  const list = useSyncExternalStore(
    subscribe,
    () => conversations,
    () => conversations,
  );
  return { conversations: list, unread: totalUnread(list) };
}
