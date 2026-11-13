import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ChatMessage, ConversationSummary, MessageKind } from "../chat";
import { getSupabase } from "../supabase";

export const CHAT_BUCKET = "chat";
const SIGNED_SECONDS = 3600;
const PAGE = 50;

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: MessageKind;
  body: string | null;
  media_path: string | null;
  poster_path: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  created_at: string;
};

export function rowToMessage(r: MessageRow): ChatMessage {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    kind: r.kind,
    body: r.body,
    mediaPath: r.media_path,
    posterPath: r.poster_path,
    width: r.width,
    height: r.height,
    duration: r.duration,
    createdAt: r.created_at,
  };
}

function fail(message: string, error: { message: string } | null): never {
  const offline = error && /failed to fetch|network/i.test(error.message);
  throw new Error(offline ? "Sem conexão com a internet. Tente de novo." : message);
}

export async function myConversations(): Promise<ConversationSummary[]> {
  const { data, error } = await getSupabase().rpc("my_conversations");
  if (error) fail("Não conseguimos carregar as conversas.", error);
  type Row = {
    conversation_id: string;
    other_id: string;
    last_message_at: string;
    last_kind: MessageKind | null;
    last_body: string | null;
    last_sender: string | null;
    unread: number | null;
    other_last_read_at: string | null;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    conversationId: r.conversation_id,
    otherId: r.other_id,
    lastMessageAt: r.last_message_at,
    lastKind: r.last_kind ?? null,
    lastBody: r.last_body ?? null,
    lastSender: r.last_sender ?? null,
    unread: r.unread ?? 0,
    otherLastReadAt: r.other_last_read_at ?? null,
  }));
}

export async function startConversation(otherId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("start_conversation", { p_other: otherId });
  if (error) fail(/bloqueado/.test(error.message) ? "Não é possível conversar com essa pessoa." : "Não conseguimos abrir a conversa.", error);
  return data as string;
}

/** Mensagens mais recentes (ou anteriores a `before`), em ordem do mais antigo para o mais novo. */
export async function fetchMessages(conversationId: string, before?: string): Promise<ChatMessage[]> {
  let q = getSupabase().from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(PAGE);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) fail("Não conseguimos carregar as mensagens.", error);
  return ((data ?? []) as MessageRow[]).map(rowToMessage).reverse();
}

export interface OutgoingMessage {
  kind: "text" | "image" | "video";
  body?: string | null;
  mediaPath?: string | null;
  posterPath?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
}

export async function sendMessage(conversationId: string, me: string, m: OutgoingMessage): Promise<ChatMessage> {
  const { data, error } = await getSupabase()
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: me,
      kind: m.kind,
      body: m.body ?? null,
      media_path: m.mediaPath ?? null,
      poster_path: m.posterPath ?? null,
      width: m.width ? Math.round(m.width) : null,
      height: m.height ? Math.round(m.height) : null,
      duration: m.duration ?? null,
    })
    .select("*")
    .single();
  if (error) fail("Não conseguimos enviar a mensagem.", error);
  return rowToMessage(data as MessageRow);
}

export async function markRead(conversationId: string, me: string) {
  await getSupabase()
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", me);
}

export async function otherLastRead(conversationId: string, me: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from("conversation_members")
    .select("last_read_at")
    .eq("conversation_id", conversationId)
    .neq("user_id", me)
    .maybeSingle();
  return (data as { last_read_at: string } | null)?.last_read_at ?? null;
}

/** Envia foto/vídeo para a pasta privada da conversa. Devolve o caminho (não um link público). */
export async function uploadChatMedia(conversationId: string, blob: Blob, ext: string): Promise<string> {
  const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await getSupabase().storage.from(CHAT_BUCKET).upload(path, blob, { contentType: blob.type || undefined, upsert: false });
  if (error) throw new Error("Não conseguimos enviar sua foto/vídeo. Tente de novo.");
  return path;
}

export async function removeChatMedia(paths: string[]) {
  if (paths.length) await getSupabase().storage.from(CHAT_BUCKET).remove(paths).catch(() => {});
}

const signed = new Map<string, { url: string; until: number }>();

/** Link temporário (1 h) para abrir uma mídia da conversa. */
export async function signedChatUrl(path: string): Promise<string> {
  const hit = signed.get(path);
  if (hit && hit.until > Date.now() + 60_000) return hit.url;
  const { data, error } = await getSupabase().storage.from(CHAT_BUCKET).createSignedUrl(path, SIGNED_SECONDS);
  if (error || !data) throw new Error("Não foi possível abrir essa mídia.");
  signed.set(path, { url: data.signedUrl, until: Date.now() + SIGNED_SECONDS * 1000 });
  return data.signedUrl;
}

export async function reportMessage(me: string, message: ChatMessage, reason: string) {
  const { error } = await getSupabase()
    .from("reports")
    .insert({
      reporter_id: me,
      target_type: "message",
      target_id: message.id,
      reason,
      details: "", // o banco preenche com o conteúdo real da mensagem
    });
  if (error) fail("Não conseguimos enviar a denúncia.", error);
}

/** Avisa de mensagens novas e de "visto" em tempo real. Devolve uma função para parar. */
export function subscribeChat(
  key: string,
  handlers: { onMessage?: (m: ChatMessage) => void; onRead?: (conversationId: string, userId: string, at: string) => void },
  conversationId?: string,
): () => void {
  const db = getSupabase();
  let channel: RealtimeChannel = db.channel(`chat-${key}`);
  const filter = conversationId ? `conversation_id=eq.${conversationId}` : undefined;
  channel = channel.on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "messages", ...(filter ? { filter } : {}) },
    (p) => handlers.onMessage?.(rowToMessage(p.new as MessageRow)),
  );
  if (handlers.onRead) {
    channel = channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "conversation_members", ...(filter ? { filter } : {}) },
      (p) => {
        const r = p.new as { conversation_id: string; user_id: string; last_read_at: string };
        handlers.onRead?.(r.conversation_id, r.user_id, r.last_read_at);
      },
    );
  }
  channel.subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}
