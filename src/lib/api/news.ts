import type { NewsItem } from "../news";
import { getSupabase } from "../supabase";

/** Notícias mais recentes guardadas pela função diária. */
export async function fetchNews(limit = 60): Promise<NewsItem[]> {
  const { data, error } = await getSupabase()
    .from("news")
    .select("title, url, summary, image, source, published_at")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error("Não conseguimos carregar as notícias.");
  return ((data ?? []) as { title: string; url: string; summary: string; image: string | null; source: string; published_at: string | null }[]).map(
    (r) => ({ title: r.title, url: r.url, summary: r.summary, image: r.image, source: r.source, publishedAt: r.published_at }),
  );
}
