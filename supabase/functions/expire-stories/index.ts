// Apaga stories vencidos (mais de 24 h) e mídia de conversas com mais de 30 dias. Chamada pelo agendador do Supabase a cada hora.
// Não exige segredo: só mexe no que já venceu.
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const MARKER = "/storage/v1/object/public/media/";
const pathFromUrl = (url: string | null) => {
  if (!url) return null;
  const i = url.indexOf(MARKER);
  return i === -1 ? null : decodeURIComponent(url.slice(i + MARKER.length));
};

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Sem segredo: a função só apaga stories que JÁ venceram (invisíveis para todos),
  // então chamá-la fora de hora não causa dano.
  const { data, error } = await admin
    .from("stories")
    .select("id, src, poster")
    .lt("expires_at", new Date().toISOString())
    .limit(500);
  if (error) return json({ error: error.message }, 500);
  let apagados = 0;
  if (data?.length) {
    const paths = data.flatMap((s) => [pathFromUrl(s.src), pathFromUrl(s.poster)]).filter((p): p is string => !!p);
    if (paths.length) await admin.storage.from("media").remove(paths);
    const { error: delError } = await admin.from("stories").delete().in("id", data.map((s) => s.id));
    if (delError) return json({ error: delError.message }, 500);
    apagados = data.length;
  }

  // Fotos e vídeos de conversas com mais de 30 dias: apaga o arquivo e deixa "mídia expirada" (o texto fica).
  const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: velhas, error: chatError } = await admin
    .from("messages")
    .select("id, media_path, poster_path")
    .in("kind", ["image", "video"])
    .lt("created_at", limite)
    .limit(500);
  if (chatError) return json({ error: chatError.message }, 500);
  let midiasConversa = 0;
  if (velhas?.length) {
    const chatPaths = velhas.flatMap((m) => [m.media_path, m.poster_path]).filter((p): p is string => !!p);
    if (chatPaths.length) await admin.storage.from("chat").remove(chatPaths);
    const { error: upError } = await admin
      .from("messages")
      .update({ kind: "expired", media_path: null, poster_path: null })
      .in("id", velhas.map((m) => m.id));
    if (upError) return json({ error: upError.message }, 500);
    midiasConversa = velhas.length;
  }
  return json({ ok: true, apagados, midiasConversa });
});
