import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Camera, Check, CheckCheck, Flag, Image as ImageIcon, Loader2, SendHorizontal } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/vm/ConfirmDialog";
import { MediaImage } from "@/components/vm/media/MediaImage";
import { VideoPlayer } from "@/components/vm/media/VideoPlayer";
import { UserAvatar } from "@/components/vm/UserAvatar";
import * as Chat from "@/lib/api/chat";
import { extFor } from "@/lib/api/media";
import { messageStatus, type ChatMessage } from "@/lib/chat";
import { captureVideoFrame, probeVideo, renderImage } from "@/lib/media-processing";
import { prepareVideo, unlockAudio, videoProblem } from "@/lib/prepare-media";
import { useAppState } from "@/lib/store";
import { refreshConversations, useConversations } from "@/lib/use-conversations";
import { cn } from "@/lib/utils";

const CameraCapture = lazy(() => import("@/components/vm/camera/CameraCapture").then((m) => ({ default: m.CameraCapture })));

export const Route = createFileRoute("/_rede/conversa/$id")({
  head: () => ({ meta: [{ title: "Conversa — Vozes do Muro" }] }),
  component: Conversation,
});

const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

function Conversation() {
  const { id } = Route.useParams();
  const meId = useAppState((s) => s.sessionUserId)!;
  const users = useAppState((s) => s.users);
  const { conversations } = useConversations(meId);
  const summary = conversations.find((c) => c.conversationId === id);
  const other = users.find((u) => u.id === summary?.otherId);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasOlder, setHasOlder] = useState(false);
  const [otherRead, setOtherRead] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [reporting, setReporting] = useState<ChatMessage | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const scrollDown = (force = false) =>
    window.setTimeout(() => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 400;
      if (force || nearBottom) bottom.current?.scrollIntoView({ block: "end" });
    }, 50);

  const add = useCallback((m: ChatMessage) => {
    setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
  }, []);

  // Carrega as mensagens, marca como lida e ouve as novas em tempo real.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMessages([]);
    Promise.all([Chat.fetchMessages(id), Chat.otherLastRead(id, meId)])
      .then(([list, read]) => {
        if (!alive) return;
        // Junta com o que chegou em tempo real durante o carregamento.
        setMessages((live) => {
          const ids = new Set(list.map((m) => m.id));
          return [...list, ...live.filter((m) => !ids.has(m.id))].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        });
        setHasOlder(list.length >= 50);
        setOtherRead(read);
        scrollDown(true);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Não conseguimos abrir a conversa."))
      .finally(() => alive && setLoading(false));
    void Chat.markRead(id, meId).then(() => refreshConversations());
    const stop = Chat.subscribeChat(
      `conversa-${id}`,
      {
        onMessage: (m) => {
          add(m);
          scrollDown();
          if (m.senderId !== meId) void Chat.markRead(id, meId).then(() => refreshConversations());
        },
        onRead: (_c, userId, at) => {
          if (userId !== meId) setOtherRead(at);
        },
      },
      id,
    );
    return () => {
      alive = false;
      stop();
    };
  }, [id, meId, add]);

  const loadOlder = async () => {
    const first = messages[0];
    if (!first) return;
    const older = await Chat.fetchMessages(id, first.createdAt).catch(() => []);
    setHasOlder(older.length >= 50);
    setMessages((list) => [...older, ...list]);
  };

  const sendText = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending("Enviando…");
    try {
      add(await Chat.sendMessage(id, meId, { kind: "text", body }));
      setText("");
      scrollDown();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não conseguimos enviar.");
    } finally {
      setSending(null);
    }
  };

  /** Foto/vídeo: prepara no aparelho, envia para a pasta privada e manda a mensagem. */
  const sendFile = async (file: File) => {
    if (sending) return;
    const isVideo = file.type.startsWith("video/");
    const audioCtx = isVideo ? unlockAudio() : undefined;
    const uploaded: string[] = [];
    const url = URL.createObjectURL(file);
    try {
      if (isVideo) {
        setSending("Preparando vídeo…");
        const meta = await probeVideo(url);
        const problem = videoProblem(file, meta.duration);
        if (problem) throw new Error(problem);
        const poster = await captureVideoFrame(url, Math.min(1, meta.duration / 2));
        const video = await prepareVideo(file, meta.duration, (r) => setSending(`Preparando vídeo… ${Math.round(r * 100)}%`), { audioCtx });
        setSending("Enviando…");
        const mediaPath = await Chat.uploadChatMedia(id, video, extFor(video, "mp4"));
        uploaded.push(mediaPath);
        const posterPath = await Chat.uploadChatMedia(id, poster, extFor(poster, "webp"));
        uploaded.push(posterPath);
        add(await Chat.sendMessage(id, meId, { kind: "video", mediaPath, posterPath, width: meta.width, height: meta.height, duration: meta.duration }));
      } else {
        setSending("Enviando foto…");
        const out = await renderImage(url, "original", 0.5, 1440);
        const mediaPath = await Chat.uploadChatMedia(id, out.blob, extFor(out.blob, "webp"));
        uploaded.push(mediaPath);
        add(await Chat.sendMessage(id, meId, { kind: "image", mediaPath, width: out.width, height: out.height }));
      }
      scrollDown();
    } catch (e) {
      void Chat.removeChatMedia(uploaded);
      toast.error(e instanceof Error ? e.message : "Não conseguimos enviar.");
    } finally {
      URL.revokeObjectURL(url);
      setSending(null);
      void audioCtx?.close().catch(() => {});
    }
  };

  const lastMineId = useMemo(() => [...messages].reverse().find((m) => m.senderId === meId)?.id, [messages, meId]);

  return (
    <div className="mx-auto flex max-w-xl flex-col">
      <header className="sticky top-14 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
        <Link to="/mensagens" aria-label="Voltar para Mensagens" className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="size-5" />
        </Link>
        {other ? (
          <Link to="/u/$username" params={{ username: other.username }} className="flex min-w-0 items-center gap-2">
            <UserAvatar user={other} size="sm" />
            <span className="min-w-0">
              <span className="block truncate font-bold">{other.name}</span>
              <span className="block truncate text-xs text-muted-foreground">@{other.username}</span>
            </span>
          </Link>
        ) : (
          <span className="font-bold">Conversa</span>
        )}
      </header>

      <div className="flex-1 space-y-2 px-3 pb-44 pt-3">
        {loading && <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />}
        {hasOlder && (
          <Button variant="ghost" size="sm" className="mx-auto block" onClick={() => void loadOlder()}>
            Carregar anteriores
          </Button>
        )}
        {!loading && messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">Mande a primeira mensagem. Respeito sempre. 🧡</p>
        )}
        {messages.map((m, i) => {
          const mine = m.senderId === meId;
          const newDay = i === 0 || day(messages[i - 1]!.createdAt) !== day(m.createdAt);
          return (
            <div key={m.id}>
              {newDay && <p className="my-3 text-center text-xs text-muted-foreground">{day(m.createdAt)}</p>}
              <div className={cn("group flex items-end gap-1", mine ? "justify-end" : "justify-start")}>
                {!mine && m.kind !== "expired" && (
                  <button
                    type="button"
                    onClick={() => setReporting(m)}
                    aria-label="Denunciar mensagem"
                    className="order-2 rounded-full p-1 text-muted-foreground opacity-60 hover:opacity-100"
                  >
                    <Flag className="size-3.5" />
                  </button>
                )}
                <div
                  className={cn(
                    "max-w-[78%] overflow-hidden rounded-2xl text-sm",
                    mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card",
                    m.kind === "text" ? "px-3 py-2" : "p-1",
                  )}
                >
                  {m.kind === "text" && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  {m.kind === "image" && m.mediaPath && (
                    <MediaImage src={`chat:${m.mediaPath}`} alt="Foto enviada na conversa" width={m.width ?? 800} height={m.height ?? 800} className="max-h-80 w-full rounded-xl object-cover" />
                  )}
                  {m.kind === "video" && m.mediaPath && (
                    <div className="w-64 max-w-full">
                      <VideoPlayer
                        src={`chat:${m.mediaPath}`}
                        poster={m.posterPath ? `chat:${m.posterPath}` : undefined}
                        alt="Vídeo enviado na conversa"
                        width={m.width ?? 540}
                        height={m.height ?? 960}
                        className="w-full rounded-xl"
                      />
                    </div>
                  )}
                  {m.kind === "expired" && <p className="px-2 py-1 italic opacity-70">Mídia expirada (fica 30 dias) ou removida.</p>}
                  <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", mine ? "text-primary-foreground/80" : "text-muted-foreground", m.kind !== "text" && "px-2 pb-1")}>
                    {time(m.createdAt)}
                    {mine && m.id === lastMineId && (messageStatus(m.createdAt, otherRead) === "visto" ? <CheckCheck className="size-3.5" aria-label="Visto" /> : <Check className="size-3.5" aria-label="Enviado" />)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {/* Barra de escrever: fica acima do selo do Lovable (canto de baixo). */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3rem)] z-30 mx-auto max-w-xl px-3">
        {sending && (
          <p className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> {sending}
          </p>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-background/95 p-2 shadow-lg backdrop-blur">
          <button type="button" onClick={() => setCamera(true)} disabled={!!sending} aria-label="Abrir câmera" className="rounded-full p-2 text-primary hover:bg-muted disabled:opacity-40">
            <Camera className="size-5" />
          </button>
          <button type="button" onClick={() => gallery.current?.click()} disabled={!!sending} aria-label="Enviar da galeria" className="rounded-full p-2 text-primary hover:bg-muted disabled:opacity-40">
            <ImageIcon className="size-5" />
          </button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendText();
              }
            }}
            placeholder="Mensagem"
            maxLength={2000}
            rows={1}
            className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent py-2 focus-visible:ring-0"
          />
          <button
            type="button"
            onClick={() => void sendText()}
            disabled={!text.trim() || !!sending}
            aria-label="Enviar"
            className="rounded-full bg-primary p-2.5 text-primary-foreground disabled:opacity-40"
          >
            <SendHorizontal className="size-5" />
          </button>
        </div>
        <input
          ref={gallery}
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void sendFile(f);
          }}
        />
      </div>

      {camera && (
        <Suspense fallback={null}>
          <CameraCapture
            multiple={false}
            onClose={() => setCamera(false)}
            onFiles={(files) => {
              setCamera(false);
              if (files[0]) void sendFile(files[0]);
            }}
          />
        </Suspense>
      )}

      <ConfirmDialog
        open={!!reporting}
        onOpenChange={(o) => !o && setReporting(null)}
        title="Denunciar mensagem?"
        description="A equipe de moderação vai ver só esta mensagem para avaliar. Você também pode bloquear a pessoa pelo perfil dela."
        confirmLabel="Denunciar"
        destructive
        onConfirm={async () => {
          if (!reporting) return;
          try {
            await Chat.reportMessage(meId, reporting, "Mensagem imprópria");
            toast.success("Denúncia enviada. Obrigado por cuidar da comunidade.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não conseguimos enviar a denúncia.");
          }
          setReporting(null);
        }}
      />
    </div>
  );
}
