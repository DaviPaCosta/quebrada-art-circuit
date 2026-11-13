-- Etapa 2: rede social online (posts, stories, comentários, curtidas, seguir, salvar, bloquear,
-- notificações, denúncias) + pasta de mídia. Todas as tabelas com RLS.

-- ===================== Tabelas =====================

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('imagem', 'video', 'carrossel')),
  title text not null default '' check (char_length(title) <= 80),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null,
  credits text not null default '' check (char_length(credits) <= 200),
  tags text[] not null default '{}',
  region text check (char_length(region) <= 60),
  removed boolean not null default false,
  created_at timestamptz not null default now()
);
create index posts_created_at_idx on public.posts (created_at desc);
create index posts_author_idx on public.posts (author_id);

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  position int not null default 0,
  kind text not null check (kind in ('image', 'video')),
  src text not null,
  poster text,
  width int not null default 0,
  height int not null default 0,
  alt text not null default '' check (char_length(alt) <= 300),
  duration real
);
create index post_media_post_idx on public.post_media (post_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id);

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table public.saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('image', 'video')),
  src text not null,
  poster text,
  width int not null default 0,
  height int not null default 0,
  alt text not null default '',
  duration real,
  caption text not null default '' check (char_length(caption) <= 200),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index stories_expires_idx on public.stories (expires_at);

create table public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (story_id, user_id)
);

create table public.story_reactions (
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (story_id, user_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('like', 'comment', 'follow', 'moderacao', 'story', 'mention', 'reply', 'commentLike')),
  post_id uuid references public.posts (id) on delete cascade,
  text text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'user', 'comment')),
  target_id text not null,
  reason text not null check (char_length(reason) <= 100),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'pendente' check (status in ('pendente', 'removido', 'arquivado')),
  created_at timestamptz not null default now()
);

-- Post em destaque no perfil (precisa ser da própria pessoa).
alter table public.profiles add column pinned_post_id uuid references public.posts (id) on delete set null;

-- ===================== Funções auxiliares =====================

create or replace function public.is_moderator()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.is_moderator from public.profiles p where p.id = (select auth.uid())), false);
$$;

-- Fica no esquema "private" (não exposto pela API), para ninguém consultar quem bloqueou quem.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.blocked_between(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;
revoke all on function private.blocked_between(uuid, uuid) from public, anon;
grant execute on function private.blocked_between(uuid, uuid) to authenticated;

-- Post que a pessoa logada pode ver (não removido ou dela/moderador, e sem bloqueio entre os dois).
create or replace function public.post_visible(p_post uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post
      and (not p.removed or p.author_id = (select auth.uid()) or public.is_moderator())
      and (public.is_moderator() or not private.blocked_between((select auth.uid()), p.author_id))
  );
$$;

-- Cria uma notificação, menos para si mesmo e entre pessoas bloqueadas.
create or replace function public.notify(p_user uuid, p_actor uuid, p_type text, p_post uuid, p_text text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_user is null or p_user = p_actor or private.blocked_between(p_user, p_actor) then
    return;
  end if;
  insert into public.notifications (user_id, actor_id, type, post_id, text)
  values (p_user, p_actor, p_type, p_post, p_text);
end;
$$;
revoke all on function public.notify(uuid, uuid, text, uuid, text) from public, anon, authenticated;

-- ===================== Proteções =====================

-- Autor edita o próprio post; só moderador mexe em "removed"; moderador em post alheio só mexe em "removed".
create or replace function public.protect_post_columns()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  new_removed boolean := new.removed;
begin
  if current_user in ('authenticated', 'anon') then
    if old.author_id <> (select auth.uid()) then
      new := old;
      new.removed := new_removed;
    end if;
    new.id := old.id;
    new.author_id := old.author_id;
    new.created_at := old.created_at;
    if not public.is_moderator() then
      new.removed := old.removed;
    end if;
  end if;
  return new;
end;
$$;
create trigger protect_post_columns before update on public.posts
  for each row execute function public.protect_post_columns();

-- Na criação pelo app, datas e situação vêm do servidor (ninguém fixa post no topo nem story eterno).
create or replace function public.force_insert_defaults()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.created_at := now();
    if tg_table_name = 'posts' then
      new.removed := false;
    elsif tg_table_name = 'stories' then
      new.expires_at := now() + interval '24 hours';
    elsif tg_table_name = 'reports' then
      new.status := 'pendente';
    end if;
  end if;
  return new;
end;
$$;
create trigger force_insert_defaults before insert on public.posts
  for each row execute function public.force_insert_defaults();
create trigger force_insert_defaults before insert on public.stories
  for each row execute function public.force_insert_defaults();
create trigger force_insert_defaults before insert on public.comments
  for each row execute function public.force_insert_defaults();
create trigger force_insert_defaults before insert on public.reports
  for each row execute function public.force_insert_defaults();

-- Post em destaque precisa ser da própria pessoa.
create or replace function public.check_pinned_post()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.pinned_post_id is not null and not exists (
    select 1 from public.posts where id = new.pinned_post_id and author_id = new.id
  ) then
    raise exception 'destaque_invalido';
  end if;
  return new;
end;
$$;
create trigger check_pinned_post before insert or update of pinned_post_id on public.profiles
  for each row execute function public.check_pinned_post();

-- Notificação só muda o "lida".
create or replace function public.protect_notification_columns()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new := old;
    new.read := true;
  end if;
  return new;
end;
$$;
create trigger protect_notification_columns before update on public.notifications
  for each row execute function public.protect_notification_columns();

-- ===================== Notificações automáticas =====================

create or replace function public.on_post_like()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.notify((select author_id from public.posts where id = new.post_id), new.user_id, 'like', new.post_id, null);
  return new;
end;
$$;
create trigger notify_like after insert on public.post_likes
  for each row execute function public.on_post_like();

create or replace function public.on_comment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  post_author uuid := (select author_id from public.posts where id = new.post_id);
  parent_author uuid := (select author_id from public.comments where id = new.parent_id);
begin
  perform public.notify(post_author, new.author_id, 'comment', new.post_id, left(new.text, 80));
  if parent_author is not null and parent_author <> post_author then
    perform public.notify(parent_author, new.author_id, 'reply', new.post_id, left(new.text, 80));
  end if;
  return new;
end;
$$;
create trigger notify_comment after insert on public.comments
  for each row execute function public.on_comment();

create or replace function public.on_comment_like()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  c record;
begin
  select author_id, post_id into c from public.comments where id = new.comment_id;
  perform public.notify(c.author_id, new.user_id, 'commentLike', c.post_id, null);
  return new;
end;
$$;
create trigger notify_comment_like after insert on public.comment_likes
  for each row execute function public.on_comment_like();

create or replace function public.on_follow()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.notify(new.followee_id, new.follower_id, 'follow', null, null);
  return new;
end;
$$;
create trigger notify_follow after insert on public.follows
  for each row execute function public.on_follow();

create or replace function public.on_story_reaction()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.notify((select author_id from public.stories where id = new.story_id), new.user_id, 'story', null, null);
  return new;
end;
$$;
create trigger notify_story_reaction after insert on public.story_reactions
  for each row execute function public.on_story_reaction();

create or replace function public.on_post_removed()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.removed and not old.removed then
    insert into public.notifications (user_id, actor_id, type, post_id, text)
    values (new.author_id, coalesce((select auth.uid()), new.author_id), 'moderacao', new.id,
            'Sua publicação foi removida pela moderação por não seguir as regras de convivência.');
  end if;
  return new;
end;
$$;
create trigger notify_post_removed after update of removed on public.posts
  for each row execute function public.on_post_removed();

-- Menções: o app manda os @ citados; o banco confere o autor e avisa (máx. 10, uma vez por post).
create or replace function public.notify_mentions(p_post uuid, p_comment uuid, p_usernames text[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  target record;
begin
  if p_comment is not null then
    if not exists (select 1 from public.comments where id = p_comment and author_id = me and post_id = p_post) then
      raise exception 'mencao_invalida';
    end if;
  elsif not exists (select 1 from public.posts where id = p_post and author_id = me) then
    raise exception 'mencao_invalida';
  end if;

  for target in
    select p.id from public.profiles p
    where p.username = any (array(select lower(u) from unnest(p_usernames[1:10]) u))
  loop
    if not exists (
      select 1 from public.notifications
      where user_id = target.id and actor_id = me and type = 'mention' and post_id = p_post
    ) then
      perform public.notify(target.id, me, 'mention', p_post, null);
    end if;
  end loop;
end;
$$;
revoke all on function public.notify_mentions(uuid, uuid, text[]) from public, anon;
grant execute on function public.notify_mentions(uuid, uuid, text[]) to authenticated;

-- ===================== RLS =====================

alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.comment_likes enable row level security;
alter table public.saves enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.story_reactions enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;

-- posts
create policy "posts: ver" on public.posts for select to authenticated
  using ((not removed or author_id = (select auth.uid()) or public.is_moderator())
         and (public.is_moderator() or not private.blocked_between((select auth.uid()), author_id)));
create policy "posts: criar" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "posts: editar" on public.posts for update to authenticated
  using (author_id = (select auth.uid()) or public.is_moderator());
create policy "posts: apagar" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));

-- post_media
create policy "midia: ver" on public.post_media for select to authenticated
  using (public.post_visible(post_id));
create policy "midia: criar" on public.post_media for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));
create policy "midia: apagar" on public.post_media for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));

-- comments
create policy "comentarios: ver" on public.comments for select to authenticated
  using (public.post_visible(post_id)
         and (public.is_moderator() or not private.blocked_between((select auth.uid()), author_id)));
create policy "comentarios: criar" on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and public.post_visible(post_id));
create policy "comentarios: apagar" on public.comments for delete to authenticated
  using (author_id = (select auth.uid())
         or public.is_moderator()
         or exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));

-- curtidas
create policy "curtidas: ver" on public.post_likes for select to authenticated
  using (public.post_visible(post_id));
create policy "curtidas: dar" on public.post_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.post_visible(post_id));
create policy "curtidas: tirar" on public.post_likes for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "curtidas comentario: ver" on public.comment_likes for select to authenticated
  using (exists (select 1 from public.comments c where c.id = comment_id and public.post_visible(c.post_id)));
create policy "curtidas comentario: dar" on public.comment_likes for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.comments c where c.id = comment_id and public.post_visible(c.post_id)));
create policy "curtidas comentario: tirar" on public.comment_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- salvos (só a própria pessoa vê)
create policy "salvos: dono" on public.saves for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- seguir
create policy "seguir: ver" on public.follows for select to authenticated using (true);
create policy "seguir: seguir" on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and not private.blocked_between(follower_id, followee_id));
create policy "seguir: deixar" on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

-- bloqueios (cada um vê os próprios)
create policy "bloqueios: dono" on public.blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

-- stories
create policy "stories: ver" on public.stories for select to authenticated
  using (author_id = (select auth.uid())
         or (expires_at > now() and not private.blocked_between((select auth.uid()), author_id)));
create policy "stories: criar" on public.stories for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "stories: apagar" on public.stories for delete to authenticated
  using (author_id = (select auth.uid()));

create policy "vistos: ver" on public.story_views for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.stories s where s.id = story_id and s.author_id = (select auth.uid())));
create policy "vistos: marcar" on public.story_views for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.stories s where s.id = story_id));

create policy "reacoes: ver" on public.story_reactions for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.stories s where s.id = story_id and s.author_id = (select auth.uid())));
create policy "reacoes: reagir" on public.story_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.stories s where s.id = story_id));

-- notificações (só lê, marca como lida e apaga as próprias; ninguém cria pelo app)
create policy "notificacoes: ver" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notificacoes: marcar lida" on public.notifications for update to authenticated
  using (user_id = (select auth.uid()));
create policy "notificacoes: apagar" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- denúncias
create policy "denuncias: enviar" on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy "denuncias: moderador ve" on public.reports for select to authenticated
  using (public.is_moderator() or reporter_id = (select auth.uid()));
create policy "denuncias: moderador decide" on public.reports for update to authenticated
  using (public.is_moderator());

-- ===================== Perfil público com destaque =====================

create or replace view public.public_profiles
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
  created_at,
  pinned_post_id
from public.profiles;

-- ===================== Pasta de mídia =====================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 20971520,
        array['image/webp', 'image/jpeg', 'image/png', 'video/webm', 'video/mp4'])
on conflict (id) do nothing;

create policy "media: ver propria pasta" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media: enviar na propria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media: apagar da propria pasta" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
