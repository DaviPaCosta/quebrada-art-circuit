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
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
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
      title: decodeEntities(title),
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
