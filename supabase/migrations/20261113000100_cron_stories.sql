-- Agenda a limpeza de stories vencidos a cada hora (minuto 0).
-- Antes de rodar: guarde o mesmo segredo no Vault (nome cron_secret) e nos Secrets da função (CRON_SECRET).
--   select vault.create_secret('<um texto longo e aleatório>', 'cron_secret');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'expirar-stories',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://eiyydsceqgomnsghbscf.supabase.co/functions/v1/expire-stories',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
