import { createFileRoute } from "@tanstack/react-router";
import { Clock, MapPin, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/vm/AppShell";
import { EVENTS } from "@/lib/mock-data";
import { eventDate } from "@/lib/format";
import { actions, useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { CulturalEvent } from "@/lib/types";

export const Route = createFileRoute("/_rede/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda cultural — Vozes do Muro" },
      { name: "description", content: "Oficinas, saraus, batalhas de rima e exposições comunitárias." },
      { property: "og:title", content: "Agenda cultural — Vozes do Muro" },
      { property: "og:description", content: "Eventos culturais autorizados nas quebradas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Agenda,
});

const KINDS: (CulturalEvent["kind"] | "Todos")[] = ["Todos", "Oficina", "Sarau", "Batalha", "Exposição", "Mutirão"];

function Agenda() {
  const [kind, setKind] = useState<(typeof KINDS)[number]>("Todos");
  const meId = useAppState((s) => s.sessionUserId!);
  const interest = useAppState((s) => s.eventInterest[meId] ?? []);
  const events = EVENTS.filter((e) => kind === "Todos" || e.kind === kind);

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <PageTitle kicker="cola com a gente">Agenda</PageTitle>
      <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 sm:px-0">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold",
              kind === k ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground",
            )}
          >
            {k}
          </button>
        ))}
      </div>
      <ul className="mt-6 space-y-4 px-4 sm:px-0">
        {events.map((e) => {
          const d = eventDate(e.date);
          const going = interest.includes(e.id);
          return (
            <li key={e.id} className="flex gap-4 rounded-lg border border-border bg-card p-4">
              <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-md bg-primary py-2 text-primary-foreground">
                <span className="font-display text-3xl leading-none">{d.day}</span>
                <span className="text-xs font-bold uppercase">{d.month}</span>
              </div>
              <div className="min-w-0 flex-1">
                <span className="tape text-xs">{e.kind}</span>
                <h2 className="mt-2 text-2xl">{e.title}</h2>
                <p className="mt-1 text-sm text-foreground/90">{e.description}</p>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1 capitalize">
                    <Clock className="size-3.5" /> {d.weekday} · {e.time}
                  </p>
                  <p className="flex items-center gap-1">
                    <MapPin className="size-3.5" /> {e.place}
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Button
                    size="sm"
                    variant={going ? "lime" : "following"}
                    aria-pressed={going}
                    onClick={() => {
                      actions.toggleEventInterest(e.id);
                      if (!going) toast.success("Marcado como interesse!");
                    }}
                  >
                    <Star className={cn(going && "fill-current")} /> {going ? "Tenho interesse" : "Marcar interesse"}
                  </Button>
                  {e.free && <span className="text-xs font-bold text-accent">Gratuito</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 px-4 text-xs text-muted-foreground sm:px-0">
        Divulgamos apenas eventos em locais públicos e autorizados. Nunca compartilhamos endereços residenciais.
      </p>
    </div>
  );
}
