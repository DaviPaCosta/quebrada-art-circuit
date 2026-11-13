import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MessageCirclePlus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/vm/AppShell";
import { UserAvatar } from "@/components/vm/UserAvatar";
import * as Chat from "@/lib/api/chat";
import { chatPreview } from "@/lib/chat";
import { timeAgo } from "@/lib/format";
import { isBlockedBetween } from "@/lib/logic";
import { useAppState } from "@/lib/store";
import { refreshConversations, useConversations } from "@/lib/use-conversations";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_rede/mensagens")({
  head: () => ({ meta: [{ title: "Mensagens — Vozes do Muro" }] }),
  component: Messages,
});

function Messages() {
  const navigate = useNavigate();
  const state = useAppState((s) => s);
  const meId = state.sessionUserId!;
  const { conversations } = useConversations(meId);
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const byId = useMemo(() => new Map(state.users.map((u) => [u.id, u])), [state.users]);
  const people = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    return state.users
      .filter((u) => u.id !== meId && !isBlockedBetween(state, meId, u.id))
      .filter((u) => !q || u.username.includes(q) || u.name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [state, meId, query]);

  const open = async (otherId: string) => {
    setOpening(otherId);
    try {
      const id = await Chat.startConversation(otherId);
      void refreshConversations();
      navigate({ to: "/conversa/$id", params: { id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não conseguimos abrir a conversa.");
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="mx-auto max-w-xl pb-10">
      <PageTitle
        kicker="papo reto"
        action={
          <button
            type="button"
            onClick={() => setPicking((p) => !p)}
            aria-label={picking ? "Fechar nova conversa" : "Nova conversa"}
            className="mr-4 rounded-full bg-primary p-2.5 text-primary-foreground sm:mr-0"
          >
            {picking ? <X className="size-5" /> : <MessageCirclePlus className="size-5" />}
          </button>
        }
      >
        Mensagens
      </PageTitle>

      {picking && (
        <section className="mx-4 mb-6 rounded-lg border border-border bg-card p-3 sm:mx-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pelo nome ou @" className="h-11 pl-9" />
          </div>
          <ul className="mt-2 max-h-72 overflow-y-auto">
            {people.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  disabled={opening === u.id}
                  onClick={() => void open(u.id)}
                  className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted disabled:opacity-50"
                >
                  <UserAvatar user={u} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{u.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">@{u.username}</span>
                  </span>
                </button>
              </li>
            ))}
            {people.length === 0 && <li className="p-3 text-sm text-muted-foreground">Ninguém encontrado.</li>}
          </ul>
        </section>
      )}

      {conversations.length === 0 ? (
        <div className="mx-4 rounded-lg border border-dashed border-border bg-card p-8 text-center sm:mx-0">
          <p className="font-bold">Nenhuma conversa ainda.</p>
          <p className="mt-1 text-sm text-muted-foreground">Toque no balão + para mandar a primeira mensagem.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {conversations.map((c) => {
            const other = byId.get(c.otherId);
            return (
              <li key={c.conversationId}>
                <Link to="/conversa/$id" params={{ id: c.conversationId }} className="flex items-center gap-3 px-4 py-3 hover:bg-muted sm:px-2">
                  <UserAvatar user={other ?? null} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate", c.unread > 0 ? "font-bold" : "font-semibold")}>{other?.name ?? "Conta removida"}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(c.lastMessageAt)}</span>
                    </span>
                    <span className={cn("block truncate text-sm", c.unread > 0 ? "text-foreground" : "text-muted-foreground")}>
                      {chatPreview({ kind: c.lastKind, body: c.lastBody, mine: c.lastSender === meId })}
                    </span>
                  </span>
                  {c.unread > 0 && (
                    <span className="flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                      {c.unread}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
