-- Etapa 5: notícias dos portais de periferia + Google News, atualizadas todo dia.
create table public.news (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text not null,
  summary text not null default '',
  image text,
  source text not null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index news_published_idx on public.news (published_at desc nulls last);

alter table public.news enable row level security;
-- Qualquer pessoa logada lê; só a função do servidor (service role) grava.
create policy "noticias: ler" on public.news for select to authenticated using (true);

-- Busca as notícias todo dia às 6h de Brasília (09:00 UTC).
select cron.schedule(
  'buscar-noticias',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://eiyydsceqgomnsghbscf.supabase.co/functions/v1/fetch-news',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
