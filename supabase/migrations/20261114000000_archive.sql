-- Etapa 3: arquivar posts. Arquivado só o próprio autor vê.
alter table public.posts add column archived boolean not null default false;

drop policy "posts: ver" on public.posts;
create policy "posts: ver" on public.posts for select to authenticated
  using (
    author_id = (select auth.uid())
    or public.is_moderator()  -- moderação vê tudo (inclusive arquivado e removido) para poder agir
    or (not archived and not removed and not private.blocked_between((select auth.uid()), author_id))
  );

create or replace function public.post_visible(p_post uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post
      and (
        p.author_id = (select auth.uid())
        or public.is_moderator()
        or (not p.archived and not p.removed and not private.blocked_between((select auth.uid()), p.author_id))
      )
  );
$$;

-- Post novo sempre nasce não arquivado.
create or replace function public.force_insert_defaults()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.created_at := now();
    if tg_table_name = 'posts' then
      new.removed := false;
      new.archived := false;
    elsif tg_table_name = 'stories' then
      new.expires_at := now() + interval '24 hours';
    elsif tg_table_name = 'reports' then
      new.status := 'pendente';
    end if;
  end if;
  return new;
end;
$$;
