import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/vm/AppShell";
import { UserAvatar } from "@/components/vm/UserAvatar";
import { resolveImage } from "@/lib/images";
import { timeAgo } from "@/lib/format";
import { actions, useAppState, useCurrentUser } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Report, ReportStatus } from "@/lib/types";

export const Route = createFileRoute("/_rede/moderacao")({
  head: () => ({
    meta: [
      { title: "Moderação — Vozes do Muro" },
      { name: "description", content: "Painel para professores revisarem denúncias e publicações." },
      { property: "og:title", content: "Moderação — Vozes do Muro" },
      { property: "og:description", content: "Revisão de denúncias da comunidade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Moderation,
});

function Moderation() {
  const me = useCurrentUser()!;
  const reports = useAppState((s) => s.reports);
  const stats = useAppState((s) => ({ posts: s.posts.filter((p) => !p.removed).length, users: s.users.length }));
  const [filter, setFilter] = useState<ReportStatus>("pendente");

  if (me.role !== "moderador") {
    return (
      <div className="px-6 py-20 text-center">
        <ShieldAlert className="mx-auto size-12 text-primary" />
        <h1 className="mt-4 text-4xl">Acesso restrito</h1>
        <p className="mt-2 text-muted-foreground">O painel de moderação é só para professores e equipe.</p>
      </div>
    );
  }

  const list = reports.filter((r) => r.status === filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pending = reports.filter((r) => r.status === "pendente").length;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 sm:px-0">
      <PageTitle kicker="equipe e professores">Moderação</PageTitle>
      <div className="grid grid-cols-3 gap-3">
        {[
          { n: pending, l: "pendentes" },
          { n: stats.posts, l: "publicações" },
          { n: stats.users, l: "contas" },
        ].map((s) => (
          <div key={s.l} className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="font-display text-4xl text-primary">{s.n}</p>
            <p className="text-xs text-muted-foreground">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-2">
        {(["pendente", "removido", "arquivado"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            aria-pressed={filter === s}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold capitalize",
              filter === s ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground",
            )}
          >
            {s === "pendente" ? "Pendentes" : s === "removido" ? "Removidos" : "Arquivados"}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-3">
        {list.map((r) => (
          <ReportItem key={r.id} report={r} />
        ))}
        {list.length === 0 && <p className="py-10 text-center text-muted-foreground">Nenhuma denúncia nesta lista. 🎉</p>}
      </ul>
    </div>
  );
}

function ReportItem({ report }: { report: Report }) {
  const reporter = useAppState((s) => s.users.find((u) => u.id === report.reporterId));
  const target = useAppState((s) => {
    if (report.targetType === "post") {
      const p = s.posts.find((x) => x.id === report.targetId);
      return p ? { kind: "post" as const, post: p, author: s.users.find((u) => u.id === p.authorId) } : null;
    }
    if (report.targetType === "comment") {
      const c = s.comments.find((x) => x.id === report.targetId);
      return c ? { kind: "comment" as const, comment: c, author: s.users.find((u) => u.id === c.authorId) } : null;
    }
    const u = s.users.find((x) => x.id === report.targetId || x.username === report.targetId);
    return u ? { kind: "user" as const, author: u } : null;
  });

  const label = { post: "Publicação", comment: "Comentário", user: "Perfil" }[report.targetType];

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="tape text-xs">{label}</span>
          <p className="mt-2 font-bold">{report.reason}</p>
          {report.details && <p className="mt-1 text-sm text-foreground/90">“{report.details}”</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            por @{reporter?.username ?? "anônimo"} · {timeAgo(report.createdAt)}
          </p>
        </div>
        {target?.kind === "post" && (
          <Link to="/post/$id" params={{ id: target.post.id }} className="shrink-0">
            <img src={resolveImage(target.post.image)} alt="" className="size-16 rounded object-cover" />
          </Link>
        )}
      </div>

      <div className="mt-3 rounded-md bg-muted p-3 text-sm">
        {!target ? (
          <p className="text-muted-foreground">Conteúdo não encontrado (já removido).</p>
        ) : (
          <div className="flex items-center gap-2">
            <UserAvatar user={target.author} size="xs" />
            <span className="font-semibold">@{target.author?.username}</span>
            <span className="truncate text-foreground/80">
              {target.kind === "post" ? target.post.title : target.kind === "comment" ? target.comment.text : "perfil denunciado"}
            </span>
          </div>
        )}
      </div>

      {report.status === "pendente" && (
        <div className="mt-3 flex gap-2">
          {report.targetType !== "user" && target && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                actions.resolveReport(report.id, "remover");
                toast.success("Conteúdo removido");
              }}
            >
              <Trash2 /> Remover conteúdo
            </Button>
          )}
          <Button
            size="sm"
            variant="following"
            onClick={() => {
              actions.resolveReport(report.id, "arquivar");
              toast("Denúncia arquivada");
            }}
          >
            <Archive /> Arquivar
          </Button>
        </div>
      )}
    </li>
  );
}
