// GERADO a partir de src/lib/news.ts (leitor de RSS testado) + a função abaixo. Ao mudar o leitor, copie de novo.
/**
 * Leitor de RSS sem dependências (funciona no navegador, nos testes e na Edge Function fetch-news,
 * que tem uma cópia deste arquivo). Mostramos só título, resumo curto, capa e link: a notícia
 * completa é lida no site original.
 */

export interface NewsItem {
  title: string;
  url: string;
  summary: string;
  image: string | null;
  source: string;
  publishedAt: string | null;
}

export const SUMMARY_MAX = 240;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

function unwrapCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? unwrapCdata(m[1]!).trim() : null;
}

function attr(block: string, name: string, attribute: string): string | null {
  const m = block.match(new RegExp(`<${name}\\b[^>]*\\b${attribute}="([^"]+)"`, "i"));
  return m ? decodeEntities(m[1]!) : null;
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function shorten(text: string): string {
  const clean = text.replace(/\s*\[(?:…|\.\.\.)\]\s*$/, "…").replace(/\s+…$/, "…");
  if (clean.length <= SUMMARY_MAX) return clean;
  const cut = clean.slice(0, SUMMARY_MAX - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 120 ? cut.lastIndexOf(" ") : cut.length).trim()}…`;
}

/** Lê os itens de um feed RSS. `source` é o nome do portal (Google News usa a fonte de cada item). */
export function parseRss(xml: string, source: string): NewsItem[] {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const out: NewsItem[] = [];
  for (const block of items) {
    let title = stripHtml(tag(block, "title") ?? "");
    const url = decodeEntities(tag(block, "link") ?? "").trim();
    if (!title || !/^https?:\/\//.test(url)) continue;

    const itemSource = stripHtml(tag(block, "source") ?? "") || source;
    // Google News coloca " - Fonte" no fim do título.
    if (itemSource !== source && title.endsWith(` - ${itemSource}`)) title = title.slice(0, -(itemSource.length + 3)).trim();

    const rawDesc = tag(block, "content:encoded") ?? tag(block, "description") ?? "";
    const descHtml = decodeEntities(rawDesc);
    // WordPress acrescenta "O post ... apareceu primeiro em ..."; fica só o primeiro parágrafo.
    const firstParagraph = descHtml.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? descHtml;
    let summary = stripHtml(firstParagraph);
    if (summary.startsWith(title) || summary === itemSource) summary = "";
    summary = shorten(summary.replace(new RegExp(`\\s*${itemSource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "").trim());
    if (summary === title) summary = "";

    const image =
      attr(block, "media:content", "url") ??
      attr(block, "media:thumbnail", "url") ??
      (/<enclosure\b[^>]*type="image/i.test(block) ? attr(block, "enclosure", "url") : null) ??
      descHtml.match(/<img\b[^>]*src="([^"]+)"/i)?.[1] ??
      null;

    const pub = tag(block, "pubDate") ?? tag(block, "dc:date");
    const time = pub ? Date.parse(pub) : NaN;
    out.push({
      title,
      url,
      summary,
      image: image && /^https:\/\//.test(image) ? image : null,
      source: itemSource,
      publishedAt: Number.isFinite(time) ? new Date(time).toISOString() : null,
    });
  }
  return out;
}

const titleKey = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Tira notícias repetidas (mesmo link ou mesmo título), mantendo a primeira. */
export function dedupeNews(items: NewsItem[]): NewsItem[] {
  const urls = new Set<string>();
  const titles = new Set<string>();
  return items.filter((n) => {
    const k = titleKey(n.title);
    if (urls.has(n.url) || titles.has(k)) return false;
    urls.add(n.url);
    titles.add(k);
    return true;
  });
}

/** Uma curiosidade diferente por dia (mesma o dia inteiro). */
export function curiosityOfDay<T>(list: T[], today: Date): T {
  const day = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86_400_000);
  return list[day % list.length]!;
}

// ======================= Função (Deno) =======================
// Busca os feeds, tira repetidas e guarda na tabela "news" (30 dias). Chamada 1x por dia pelo agendador.
// Sem segredo: só lê feeds públicos e grava notícias públicas; chamar fora de hora não causa dano.
import { createClient } from "npm:@supabase/supabase-js@2";

const FEEDS: [string, string][] = [
  ["Agência Mural", "https://www.agenciamural.org.br/feed/"],
  ["Alma Preta", "https://almapreta.com.br/feed/"],
  ["Periferia em Movimento", "https://periferiaemmovimento.com.br/feed/"],
  ["Nós Mulheres da Periferia", "https://nosmulheresdaperiferia.com.br/feed/"],
  ["Bocada Forte", "https://bocadaforte.com.br/feed/"],
];
const GOOGLE_QUERIES = ['"batalha de rima"', '"rap nacional"', "grafite arte urbana", "slam poesia", '"trap brasileiro"'];
const googleUrl = (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:7d&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

async function read(name: string, url: string, max: number): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; VozesDoMuro/1.0)" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    return parseRss(await res.text(), name).slice(0, max);
  } catch {
    return []; // um portal fora do ar não atrapalha os outros
  }
}

const COOLDOWN_MS = 6 * 60 * 60 * 1000;

Deno.serve(async () => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // Não roda de novo antes de 6 h (evita que alguém chame sem parar e gaste a cota).
  const { data: ultima } = await admin.from("news_runs").select("ran_at").order("ran_at", { ascending: false }).limit(1).maybeSingle();
  if (ultima && Date.now() - Date.parse(ultima.ran_at) < COOLDOWN_MS) {
    return new Response(JSON.stringify({ ok: true, pulado: "rodou há pouco" }), { headers: { "Content-Type": "application/json" } });
  }
  await admin.from("news_runs").insert({ ran_at: new Date().toISOString() });
  await admin.from("news_runs").delete().lt("ran_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  const lists = await Promise.all([
    ...FEEDS.map(([name, url]) => read(name, url, 10)),
    ...GOOGLE_QUERIES.map((q) => read("Google News", googleUrl(q), 8)),
  ]);
  const items = dedupeNews(lists.flat());
  const rows = items.map((n) => ({
    url: n.url,
    title: n.title.slice(0, 300),
    summary: n.summary,
    image: n.image,
    source: n.source.slice(0, 100),
    published_at: n.publishedAt,
  }));
  const { error } = await admin.from("news").upsert(rows, { onConflict: "url", ignoreDuplicates: true });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await admin.from("news").delete().lt("created_at", limite);
  return new Response(JSON.stringify({ ok: true, lidas: items.length }), { headers: { "Content-Type": "application/json" } });
});
