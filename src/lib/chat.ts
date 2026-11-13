/** Regras puras das conversas. */

export type MessageKind = "text" | "image" | "video" | "expired";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  kind: MessageKind;
  body: string | null;
  mediaPath: string | null;
  posterPath: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  createdAt: string;
}

export interface ConversationSummary {
  conversationId: string;
  otherId: string;
  lastMessageAt: string;
  lastKind: MessageKind | null;
  lastBody: string | null;
  lastSender: string | null;
  unread: number;
  otherLastReadAt: string | null;
}

/** ✓ enviado ou ✓✓ visto. */
export function messageStatus(createdAt: string, otherLastReadAt: string | null): "enviado" | "visto" {
  if (!otherLastReadAt) return "enviado";
  return Date.parse(otherLastReadAt) >= Date.parse(createdAt) ? "visto" : "enviado";
}

export function totalUnread(convs: { unread: number }[]): number {
  return convs.reduce((n, c) => n + c.unread, 0);
}

/** Texto curto da última mensagem, para a lista de conversas. */
export function chatPreview({ kind, body, mine }: { kind: MessageKind | null; body: string | null; mine: boolean }): string {
  if (!kind) return "Comece a conversa";
  if (kind === "expired") return "Mídia expirada";
  const text = kind === "image" ? "📷 Foto" : kind === "video" ? "🎥 Vídeo" : (body ?? "");
  return mine ? `Você: ${text}` : text;
}
