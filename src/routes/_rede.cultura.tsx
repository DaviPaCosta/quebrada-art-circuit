import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Lightbulb, Loader2, Newspaper, Quote } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageTitle } from "@/components/vm/AppShell";
import { UserAvatar } from "@/components/vm/UserAvatar";
import { CURIOSIDADES, ENTREVISTAS, GLOSSARIO, HISTORIA } from "@/lib/cultura";
import { fetchNews } from "@/lib/api/news";
import { timeAgo } from "@/lib/format";
import { curiosityOfDay, type NewsItem } from "@/lib/news";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/_rede/cultura")({
  head: () => ({
    meta: [
      { title: "Educação e cultura — Vozes do Muro" },
      { name: "description", content: "História do grafite, da pichação e do hip hop, glossário, entrevistas e curiosidades." },
      { property: "og:title", content: "Educação e cultura — Vozes do Muro" },
      { property: "og:description", content: "Aprenda sobre os movimentos artísticos das periferias." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Cultura,
});

function Cultura() {
  const [q, setQ] = useState("");
  const users = useAppState((s) => s.users);
  const glossario = GLOSSARIO.filter((g) => (g.term + g.def).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <PageTitle kicker="conhecimento é o 5º elemento">Cultura</PageTitle>
      <CuriosityOfDay />
      <Tabs defaultValue="noticias" className="px-4 sm:px-0">
        <TabsList className="scrollbar-none grid h-auto w-full grid-cols-5 bg-card text-xs sm:text-sm">
          <TabsTrigger value="noticias" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Notícias</TabsTrigger>
          <TabsTrigger value="historia" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">História</TabsTrigger>
          <TabsTrigger value="glossario" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Glossário</TabsTrigger>
          <TabsTrigger value="entrevistas" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Entrevistas</TabsTrigger>
          <TabsTrigger value="curiosidades" className="py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Curiosidades</TabsTrigger>
        </TabsList>

        <TabsContent value="noticias" className="mt-6">
          <NewsList />
        </TabsContent>

        <TabsContent value="historia" className="mt-6">
          <ol className="relative space-y-8 border-l-2 border-dashed border-primary pl-6">
            {HISTORIA.map((h) => (
              <li key={h.title} className="relative">
                <span className="absolute -left-[33px] top-1 size-4 rounded-full border-2 border-background bg-accent" />
                <p className="font-marker text-sm text-accent">{h.period}</p>
                <h2 className="mt-1 text-3xl">{h.title}</h2>
                <p className="mt-2 leading-relaxed text-foreground/90">{h.text}</p>
              </li>
            ))}
          </ol>
        </TabsContent>

        <TabsContent value="glossario" className="mt-6">
          <Input type="search" placeholder="Buscar termo" aria-label="Buscar termo no glossário" value={q} onChange={(e) => setQ(e.target.value)} className="h-11" />
          <dl className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
            {glossario.map((g) => (
              <div key={g.term} className="p-4">
                <dt className="font-display text-xl uppercase text-primary">{g.term}</dt>
                <dd className="mt-1 text-sm text-foreground/90">{g.def}</dd>
              </div>
            ))}
            {glossario.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum termo encontrado.</p>}
          </dl>
        </TabsContent>

        <TabsContent value="entrevistas" className="mt-6 space-y-4">
          <p className="text-xs text-muted-foreground">Entrevistas fictícias criadas para o protótipo escolar.</p>
          {ENTREVISTAS.map((e) => {
            const u = users.find((x) => x.username === e.username);
            return (
              <article key={e.username} className="rounded-lg border border-border bg-card p-5">
                <Link to="/u/$username" params={{ username: e.username }} className="flex items-center gap-3">
                  <UserAvatar user={u} size="md" />
                  <span>
                    <span className="block font-bold">{u?.name}</span>
                    <span className="text-xs text-muted-foreground">@{e.username}</span>
                  </span>
                </Link>
                <h2 className="mt-4 text-2xl">{e.q}</h2>
                <p className="mt-2 flex gap-2 leading-relaxed text-foreground/90">
                  <Quote className="size-5 shrink-0 text-primary" /> {e.a}
                </p>
              </article>
            );
          })}
        </TabsContent>

        <TabsContent value="curiosidades" className="mt-6 grid gap-3 sm:grid-cols-2">
          {CURIOSIDADES.map((c, i) => (
            <div key={c} className="rounded-lg border-2 border-background bg-accent p-5 text-accent-foreground shadow-[4px_4px_0_0_var(--spray)]" style={{ transform: `rotate(${i % 2 ? 1 : -1}deg)` }}>
              <Lightbulb className="size-6" />
              <p className="mt-2 font-semibold">{c}</p>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CuriosityOfDay() {
  // Calculada só no navegador, para não mudar entre o servidor e o celular.
  const [text, setText] = useState<string | null>(null);
  useEffect(() => setText(curiosityOfDay(CURIOSIDADES, new Date())), []);
  if (!text) return null;
  return (
    <section className="mx-4 mb-6 flex gap-3 rounded-lg border-2 border-background bg-accent p-4 text-accent-foreground shadow-[4px_4px_0_0_var(--spray)] sm:mx-0">
      <Lightbulb className="size-6 shrink-0" aria-hidden />
      <div>
        <p className="font-display text-sm uppercase tracking-wide">Curiosidade do dia</p>
        <p className="mt-1 font-semibold">{text}</p>
      </div>
    </section>
  );
}

function NewsList() {
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetchNews()
      .then(setNews)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">{error}</p>;
  if (!news) return <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" aria-label="Carregando notícias" />;
  if (news.length === 0)
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
        <Newspaper className="mx-auto mb-2 size-8" aria-hidden />
        As notícias chegam todo dia às 6h. Volte mais tarde!
      </div>
    );

  return (
    <ul className="space-y-3">
      <li className="text-xs text-muted-foreground">De portais da periferia e do Google News. Toque para ler no site original.</li>
      {news.map((n) => (
        <li key={n.url}>
          <a href={n.url} target="_blank" rel="noopener noreferrer" className="flex gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary">
            {n.image && (
              <img src={n.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-20 shrink-0 rounded-md object-cover sm:size-24" />
            )}
            <span className="min-w-0 flex-1">
              <span className="line-clamp-3 font-bold leading-snug">{n.title}</span>
              {n.summary && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{n.summary}</span>}
              <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                {n.source}
                {n.publishedAt && <> · {timeAgo(n.publishedAt)}</>}
                <ExternalLink className="ml-auto size-3.5" aria-hidden />
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
