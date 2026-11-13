// Apaga stories vencidos (mais de 24 h) e os arquivos deles. Chamada pelo agendador do Supabase a cada hora.
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

  // O segredo é conferido direto no Vault (nome "cron_secret").
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!given) return json({ error: "não autorizado", motivo: "sem cabeçalho x-cron-secret" }, 401);
  const { data: ok, error: rpcError } = await admin.rpc("check_cron_secret", { p_secret: given });
  if (rpcError) return json({ error: "falha ao conferir o segredo", motivo: rpcError.message }, 500);
  if (ok !== true) return json({ error: "não autorizado", motivo: "segredo diferente do Vault" }, 401);
  const { data, error } = await admin
    .from("stories")
    .select("id, src, poster")
    .lt("expires_at", new Date().toISOString())
    .limit(500);
  if (error) return json({ error: error.message }, 500);
  if (!data?.length) return json({ ok: true, apagados: 0 });

  const paths = data.flatMap((s) => [pathFromUrl(s.src), pathFromUrl(s.poster)]).filter((p): p is string => !!p);
  if (paths.length) await admin.storage.from("media").remove(paths);
  const { error: delError } = await admin.from("stories").delete().in("id", data.map((s) => s.id));
  if (delError) return json({ error: delError.message }, 500);
  return json({ ok: true, apagados: data.length });
});
