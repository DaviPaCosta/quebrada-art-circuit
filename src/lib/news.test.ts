import { describe, expect, it } from "vitest";
import { curiosityOfDay, dedupeNews, parseRss } from "./news";

const WORDPRESS = `<rss><channel><item>
  <title>Artista de Mogi cria personagem &#8220;Boquinha&#8221; para ocupar ruas</title>
  <link>https://agenciamural.org.br/artista-boquinha/</link>
  <pubDate>Thu, 12 Nov 2026 22:10:08 +0000</pubDate>
  <description><![CDATA[<p>Uma boca vermelha, grande e fora dos padrões. Em alguns muros, ela aparece colorida &amp; vibrante [&#8230;]</p>
  <p>O post <a href="https://agenciamural.org.br/artista-boquinha/">Artista</a> apareceu primeiro em <a href="https://agenciamural.org.br">Agência Mural</a>.</p>]]></description>
  <media:content url="https://agenciamural.org.br/foto.jpg" medium="image" />
</item></channel></rss>`;

const GOOGLE = `<rss><channel><item><title>Dia Mundial do Hip Hop: DF tem batalhas de rima - Brasil de Fato</title><link>https://news.google.com/rss/articles/abc?oc=5</link><pubDate>Thu, 12 Nov 2026 19:57:00 GMT</pubDate><description>&lt;a href="x"&gt;Dia Mundial do Hip Hop: DF tem batalhas de rima&lt;/a&gt;&amp;nbsp;&lt;font&gt;Brasil de Fato&lt;/font&gt;</description><source url="https://www.brasildefato.com.br">Brasil de Fato</source></item></channel></rss>`;

describe("leitor de notícias (RSS)", () => {
  it("lê portal WordPress: título, link, data, imagem e resumo limpo", () => {
    const [n] = parseRss(WORDPRESS, "Agência Mural");
    expect(n).toMatchObject({
      title: "Artista de Mogi cria personagem “Boquinha” para ocupar ruas",
      url: "https://agenciamural.org.br/artista-boquinha/",
      image: "https://agenciamural.org.br/foto.jpg",
      source: "Agência Mural",
      publishedAt: "2026-11-12T22:10:08.000Z",
    });
    expect(n!.summary).toBe("Uma boca vermelha, grande e fora dos padrões. Em alguns muros, ela aparece colorida & vibrante…");
  });

  it("lê Google News: tira a fonte do título e usa a fonte real", () => {
    const [n] = parseRss(GOOGLE, "Google News");
    expect(n).toMatchObject({ title: "Dia Mundial do Hip Hop: DF tem batalhas de rima", source: "Brasil de Fato", summary: "", image: null });
  });

  it("resumo nunca passa de 240 caracteres", () => {
    const longo = `<rss><item><title>T</title><link>https://a.b/c</link><description>${"palavra ".repeat(80)}</description></item></rss>`;
    expect(parseRss(longo, "X")[0]!.summary.length).toBeLessThanOrEqual(240);
  });

  it("código de caractere inválido não derruba o feed", () => {
    const xml = `<rss><item><title>Ok &#99999999; fim</title><link>https://a.b/c</link></item></rss>`;
    expect(parseRss(xml, "X")[0]!.title).toBe("Ok &#99999999; fim");
  });

  it("ignora itens sem título ou link", () => {
    expect(parseRss("<rss><item><title>Sem link</title></item></rss>", "X")).toEqual([]);
  });

  it("tira repetidas pelo link e pelo título", () => {
    const a = { title: "Batalha da Aldeia", url: "https://x/1", summary: "", image: null, source: "A", publishedAt: null };
    const out = dedupeNews([a, { ...a, url: "https://x/2", title: "BATALHA da aldeia!" }, { ...a, url: "https://x/1", title: "outro" }, { ...a, url: "https://x/3", title: "Slam" }]);
    expect(out.map((n) => n.url)).toEqual(["https://x/1", "https://x/3"]);
  });
});

describe("curiosidade do dia", () => {
  const lista = ["a", "b", "c"];
  it("muda a cada dia e repete o ciclo", () => {
    expect(curiosityOfDay(lista, new Date(2026, 10, 14))).not.toBe(curiosityOfDay(lista, new Date(2026, 10, 15)));
    expect(curiosityOfDay(lista, new Date(2026, 10, 14))).toBe(curiosityOfDay(lista, new Date(2026, 10, 17)));
  });
  it("é a mesma durante o dia todo", () => {
    expect(curiosityOfDay(lista, new Date(2026, 10, 14, 0, 5))).toBe(curiosityOfDay(lista, new Date(2026, 10, 14, 23, 55)));
  });
});
