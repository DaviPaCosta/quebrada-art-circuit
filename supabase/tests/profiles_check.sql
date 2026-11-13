-- Rode no SQL Editor depois de aplicar a migration. Todas as linhas devem vir com ok = true.
select 'tabela profiles' as item, to_regclass('public.profiles') is not null as ok
union all
select 'RLS ativa', relrowsecurity from pg_class where oid = 'public.profiles'::regclass
union all
select 'trigger de cadastro', exists (select 1 from pg_trigger where tgname = 'on_auth_user_created')
union all
select 'trigger de proteção', exists (select 1 from pg_trigger where tgname = 'protect_profile_columns')
union all
select 'view pública sem birth_date', not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'public_profiles' and column_name = 'birth_date')
union all
select 'username_available', public.username_available('nome.que.nao.existe')
union all
select 'username inválido recusado', not public.username_available('A');

-- Parte 2: comportamento com dados. Rode tudo de uma vez; o rollback no fim desfaz o teste.
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'teste-check@exemplo.com',
        '{"username":"teste.check","name":"teste.check","birth_date":"1980-01-01","role_choice":"aluno"}', now(), now());
select 'perfil criado pelo trigger' as item, exists (select 1 from public.profiles where username = 'teste.check') as ok
union all
select '@ ocupado aparece como indisponível', not public.username_available('teste.check')
union all
select 'adulto > 30 virou professor', (select role = 'professor' from public.profiles where username = 'teste.check');
-- O admin (painel) consegue marcar moderador:
update public.profiles set is_moderator = true where username = 'teste.check';
select 'admin marca moderador', (select is_moderator from public.profiles where username = 'teste.check') as ok;
-- O próprio usuário (pela API) não consegue se dar papel nem moderação:
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated"}', true);
update public.profiles set role = 'aluno', is_moderator = false, bio = 'oi' where id = '00000000-0000-0000-0000-0000000000aa';
reset role;
select 'usuário não muda papel/moderação, mas muda bio',
  (select role = 'professor' and is_moderator and bio = 'oi' from public.profiles where username = 'teste.check') as ok;
rollback;
