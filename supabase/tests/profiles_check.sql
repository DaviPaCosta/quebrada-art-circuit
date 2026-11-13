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
