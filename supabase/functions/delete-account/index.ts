// Exclui a conta de quem chamou. Roda no servidor do Supabase, onde a chave service_role existe.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "não autenticado" }, 401);

  // Descobre quem está chamando a partir do próprio token (nunca de um id enviado no corpo).
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: "não autenticado" }, 401);

  // Apaga os arquivos da pessoa (fotos, vídeos, stories, avatar) antes da conta.
  const folder = data.user.id;
  for (;;) {
    const { data: files } = await admin.storage.from("media").list(folder, { limit: 100 });
    if (!files?.length) break;
    const { error: rmError } = await admin.storage.from("media").remove(files.map((f) => `${folder}/${f.name}`));
    if (rmError) return json({ error: rmError.message }, 500);
  }

  const { error: delError } = await admin.auth.admin.deleteUser(data.user.id);
  if (delError) return json({ error: delError.message }, 500);
  return json({ ok: true });
});
