import { describe, expect, it } from "vitest";
import { chatPreview, messageStatus, totalUnread } from "./chat";

describe("conversas", () => {
  it("mensagem fica vista quando a outra pessoa leu depois dela", () => {
    expect(messageStatus("2026-11-14T10:00:00Z", "2026-11-14T10:05:00Z")).toBe("visto");
    expect(messageStatus("2026-11-14T10:00:00Z", "2026-11-14T10:00:00Z")).toBe("visto");
    expect(messageStatus("2026-11-14T10:00:00Z", "2026-11-14T09:59:00Z")).toBe("enviado");
    expect(messageStatus("2026-11-14T10:00:00Z", null)).toBe("enviado");
  });
  it("soma as não lidas de todas as conversas", () => {
    expect(totalUnread([{ unread: 2 }, { unread: 0 }, { unread: 5 }])).toBe(7);
    expect(totalUnread([])).toBe(0);
  });
  it("prévia da última mensagem", () => {
    expect(chatPreview({ kind: "text", body: "oi, tudo bem?", mine: false })).toBe("oi, tudo bem?");
    expect(chatPreview({ kind: "text", body: "oi", mine: true })).toBe("Você: oi");
    expect(chatPreview({ kind: "image", body: null, mine: false })).toBe("📷 Foto");
    expect(chatPreview({ kind: "video", body: null, mine: true })).toBe("Você: 🎥 Vídeo");
    expect(chatPreview({ kind: "expired", body: null, mine: false })).toBe("Mídia expirada");
    expect(chatPreview({ kind: null, body: null, mine: false })).toBe("Comece a conversa");
  });
});
