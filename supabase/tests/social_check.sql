-- Verificação da Etapa 2. Rode tudo de uma vez no SQL Editor depois da migration.
-- Cria dois usuários de teste, testa as regras e desfaz tudo no fim (rollback).
-- Resultado esperado: todas as linhas com ok = true.
begin;

create temp table resultado (item text, ok boolean) on commit drop;
grant insert, select on resultado to authenticated;

-- A = professora (1980), B = aluno (2010)
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'check-a@exemplo.com', '{"username":"check.a","name":"A","birth_date":"1980-01-01"}', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'check-b@exemplo.com', '{"username":"check.b","name":"B","birth_date":"2010-01-01"}', now(), now());

-- ===== como A: cria um post com uma foto =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
insert into public.posts (id, author_id, type, title, category)
  values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000000a', 'imagem', 'Teste', 'Grafite');
insert into public.post_media (post_id, position, kind, src, width, height)
  values ('00000000-0000-0000-0000-00000000f001', 0, 'image', 'seed:grafite', 1024, 1280);
-- A não consegue se dar "removido" (não é moderadora)
update public.posts set removed = true where id = '00000000-0000-0000-0000-00000000f001';
reset role;
insert into resultado select 'autor comum não remove o próprio post pela moderação',
  not removed from public.posts where id = '00000000-0000-0000-0000-00000000f001';

-- ===== como B: curte, tenta apagar e tentar criar notificação =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
insert into resultado select 'B enxerga o post de A', count(*) = 1 from public.posts where id = '00000000-0000-0000-0000-00000000f001';
insert into public.post_likes (post_id, user_id) values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000000b');
insert into public.comments (post_id, author_id, text) values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000000b', 'Muito bom!');
delete from public.posts where id = '00000000-0000-0000-0000-00000000f001';
update public.posts set removed = true where id = '00000000-0000-0000-0000-00000000f001';
do $$
begin
  insert into public.notifications (user_id, actor_id, type)
    values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'like');
  insert into resultado values ('cliente não cria notificação', false);
exception when others then
  insert into resultado values ('cliente não cria notificação', true);
end $$;
do $$
begin
  insert into public.posts (author_id, type, title, category)
    values ('00000000-0000-0000-0000-00000000000a', 'imagem', 'Falso', 'Grafite');
  insert into resultado values ('não publica em nome de outra pessoa', false);
exception when others then
  insert into resultado values ('não publica em nome de outra pessoa', true);
end $$;
reset role;

insert into resultado select 'B não apaga nem remove post alheio',
  (select count(*) = 1 and bool_and(not removed) from public.posts where id = '00000000-0000-0000-0000-00000000f001');
insert into resultado select 'curtida gera notificação para A',
  exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-00000000000a'
          and actor_id = '00000000-0000-0000-0000-00000000000b' and type = 'like');
insert into resultado select 'comentário gera notificação para A',
  exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-00000000000a' and type = 'comment');

-- ===== B vira moderador (pelo painel) e remove o post =====
update public.profiles set is_moderator = true where id = '00000000-0000-0000-0000-00000000000b';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
update public.posts set removed = true, title = 'hackeado' where id = '00000000-0000-0000-0000-00000000f001';
reset role;
insert into resultado select 'moderador remove, mas não edita o texto',
  (select removed and title = 'Teste' from public.posts where id = '00000000-0000-0000-0000-00000000f001');
insert into resultado select 'remoção avisa a autora',
  exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-00000000000a' and type = 'moderacao');
update public.posts set removed = false where id = '00000000-0000-0000-0000-00000000f001';
update public.profiles set is_moderator = false where id = '00000000-0000-0000-0000-00000000000b';

-- ===== A bloqueia B: B deixa de ver o post =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
insert into resultado select 'bloqueado não vê os posts de quem bloqueou', count(*) = 0 from public.posts where id = '00000000-0000-0000-0000-00000000f001';
reset role;

-- ===== pasta de arquivos =====
insert into resultado select 'bucket media existe e é público', exists (select 1 from storage.buckets where id = 'media' and public);
insert into resultado select 'regras da pasta media criadas',
  (select count(*) = 3 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'media:%');

select * from resultado;
rollback;
