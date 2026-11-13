-- A função de limpeza confere o segredo direto no Vault (um lugar só, sem copiar texto).
create or replace function public.check_cron_secret(p_secret text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'cron_secret' and decrypted_secret = p_secret
  );
$$;
revoke all on function public.check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.check_cron_secret(text) to service_role;
