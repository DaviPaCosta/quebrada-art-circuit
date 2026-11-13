import { ExternalLink, Lightbulb, Loader2, Newspaper } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchNews } from "@/lib/api/news";
import { CURIOSIDADES } from "@/lib/cultura";
import { timeAgo } from "@/lib/format";
import { curiosityOfDay, type NewsItem } from "@/lib/news";

/** Card com uma curiosidade diferente por dia. */
export function CuriosityOfDay() {
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

/** Lista de notícias do dia (portais da periferia + Google News). */
export function NewsList() {
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
