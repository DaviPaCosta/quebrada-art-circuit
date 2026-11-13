-- Etapa 1: perfis reais ligados ao Supabase Auth.
-- Papel (aluno/professor) é calculado aqui, a partir da data de nascimento, sem aparecer na tela.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._]{3,20}$'),
  name text not null check (char_length(name) between 1 and 40),
  birth_date date not null,
  role text not null check (role in ('aluno', 'professor')),
  is_moderator boolean not null default false,
  bio text not null default '' check (char_length(bio) <= 300),
  bairro text not null default '' check (char_length(bairro) <= 60),
  show_bairro boolean not null default false,
  color text not null default 'spray' check (color in ('spray', 'violet', 'lime', 'sand')),
  avatar_url text,
  cover_url text,
  styles text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Idade em anos completos no fuso de São Paulo.
create or replace function public.age_in_years(birth date)
returns int
language sql
stable
set search_path = ''
as $$
  select extract(year from age((now() at time zone 'America/Sao_Paulo')::date, birth))::int;
$$;

-- Cria o perfil quando a conta é criada no Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  birth date := (meta ->> 'birth_date')::date;
  uname text := lower(trim(both from coalesce(meta ->> 'username', '')));
  age int;
  chosen text := meta ->> 'role_choice';
  final_role text;
begin
  if birth is null then
    raise exception 'data_nascimento_obrigatoria';
  end if;
  age := public.age_in_years(birth);
  if age < 13 or age > 120 then
    raise exception 'idade_minima';
  end if;
  if uname !~ '^[a-z0-9._]{3,20}$' then
    raise exception 'username_invalido';
  end if;

  if age < 20 then
    final_role := 'aluno';
  elsif age > 30 then
    final_role := 'professor';
  elsif chosen in ('aluno', 'professor') then
    final_role := chosen;
  else
    final_role := 'aluno';
  end if;

  insert into public.profiles (id, username, name, birth_date, role, color)
  values (
    new.id,
    uname,
    left(coalesce(nullif(trim(both from meta ->> 'name'), ''), uname), 40),
    birth,
    final_role,
    (array['spray', 'violet', 'lime', 'sand'])[1 + floor(random() * 4)::int]
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- O próprio usuário não consegue mudar papel, moderação nem data de nascimento.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.id := old.id;
    new.role := old.role;
    new.is_moderator := old.is_moderator;
    new.birth_date := old.birth_date;
    new.created_at := old.created_at;
  end if;
  new.username := lower(new.username);
  return new;
end;
$$;

create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- RLS: cada um lê e edita só o próprio registro completo.
create policy "dono lê o próprio perfil"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "dono edita o próprio perfil"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Visão pública: sem data de nascimento; bairro oculto para menores de 18 ou quando a pessoa preferir.
create view public.public_profiles
with (security_invoker = false)
as
select
  id,
  username,
  name,
  role,
  is_moderator,
  bio,
  case when show_bairro and public.age_in_years(birth_date) >= 18 then bairro else '' end as bairro,
  (show_bairro and public.age_in_years(birth_date) >= 18) as show_bairro,
  color,
  avatar_url,
  cover_url,
  styles,
  created_at
from public.profiles;

revoke all on public.public_profiles from anon, public;
grant select on public.public_profiles to authenticated;

-- Checagem de @ no cadastro (antes de existir sessão).
create or replace function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(trim(both from name)) ~ '^[a-z0-9._]{3,20}$'
     and not exists (select 1 from public.profiles p where p.username = lower(trim(both from name)));
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
