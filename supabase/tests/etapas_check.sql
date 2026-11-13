-- Verificação das etapas 3, 4 e 5. Rode tudo de uma vez depois das 3 migrations; o rollback desfaz o teste.
-- Resultado esperado: todas as linhas com ok = true.
begin;

create temp table resultado (item text, ok boolean) on commit drop;
grant insert, select on resultado to authenticated;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'c1@exemplo.com', '{"username":"check.c1","name":"C1","birth_date":"2008-01-01"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'c2@exemplo.com', '{"username":"check.c2","name":"C2","birth_date":"2008-01-01"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'c3@exemplo.com', '{"username":"check.c3","name":"C3","birth_date":"2008-01-01"}', now(), now());

-- ===== Etapa 3: arquivar =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
insert into public.posts (id, author_id, type, title, category, archived)
  values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000c1', 'imagem', 'Arquivo', 'Rap', true);
insert into resultado select 'post nasce não arquivado', not archived from public.posts where id = '00000000-0000-0000-0000-00000000e001';
update public.posts set archived = true where id = '00000000-0000-0000-0000-00000000e001';
insert into resultado select 'autor vê o próprio arquivado', count(*) = 1 from public.posts where id = '00000000-0000-0000-0000-00000000e001';
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
set local role authenticated;
insert into resultado select 'outra pessoa não vê arquivado', count(*) = 0 from public.posts where id = '00000000-0000-0000-0000-00000000e001';
reset role;

-- ===== Etapa 4: conversas =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
create temp table conv on commit drop as select public.start_conversation('00000000-0000-0000-0000-0000000000c2') as id;
reset role;
grant select on conv to authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
insert into resultado select 'abrir de novo reaproveita a conversa', public.start_conversation('00000000-0000-0000-0000-0000000000c2') = (select id from conv);
insert into public.messages (conversation_id, sender_id, kind, body) select id, '00000000-0000-0000-0000-0000000000c1', 'text', 'oi' from conv;
do $$
begin
  insert into public.messages (conversation_id, sender_id, kind, body)
    select id, '00000000-0000-0000-0000-0000000000c2', 'text', 'falso' from conv;
  insert into resultado values ('não envia em nome de outra pessoa', false);
exception when others then
  insert into resultado values ('não envia em nome de outra pessoa', true);
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
set local role authenticated;
insert into resultado select 'quem está na conversa lê', count(*) = 1 from public.messages where conversation_id = (select id from conv);
insert into resultado select 'conversa mostra 1 não lida', (select unread = 1 from public.my_conversations() where conversation_id = (select id from conv));
update public.conversation_members set last_read_at = now() where conversation_id = (select id from conv) and user_id = '00000000-0000-0000-0000-0000000000c2';
insert into resultado select 'marcar como lida zera', (select unread = 0 from public.my_conversations() where conversation_id = (select id from conv));
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
set local role authenticated;
insert into resultado select 'quem está fora não lê', count(*) = 0 from public.messages where conversation_id = (select id from conv);
reset role;

-- Bloqueio: c2 bloqueia c1 → c1 não consegue mais enviar.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
set local role authenticated;
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  insert into public.messages (conversation_id, sender_id, kind, body)
    select id, '00000000-0000-0000-0000-0000000000c1', 'text', 'ainda?' from conv;
  insert into resultado values ('bloqueado não envia mensagem', false);
exception when others then
  insert into resultado values ('bloqueado não envia mensagem', true);
end $$;
reset role;

insert into resultado select 'pasta privada chat existe e é privada', exists (select 1 from storage.buckets where id = 'chat' and not public);
insert into resultado select 'mensagens em tempo real', exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages');

-- ===== Etapa 5: notícias =====
insert into public.news (url, title, source) values ('https://exemplo.com/n1', 'Teste', 'Teste');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
set local role authenticated;
insert into resultado select 'logado lê notícias', count(*) >= 1 from public.news;
do $$
begin
  insert into public.news (url, title, source) values ('https://exemplo.com/falsa', 'Falsa', 'X');
  insert into resultado values ('ninguém cria notícia pelo app', false);
exception when others then
  insert into resultado values ('ninguém cria notícia pelo app', true);
end $$;
reset role;
insert into resultado select 'busca diária agendada', exists (select 1 from cron.job where jobname = 'buscar-noticias');

select * from resultado;
rollback;
