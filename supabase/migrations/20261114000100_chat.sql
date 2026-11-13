-- Etapa 4: conversas 1 a 1 com texto, foto e vídeo. Só as duas pessoas da conversa leem.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('text', 'image', 'video', 'expired')),
  body text check (char_length(body) <= 2000),
  media_path text,
  poster_path text,
  width int,
  height int,
  duration real,
  created_at timestamptz not null default now(),
  check (kind <> 'text' or char_length(coalesce(body, '')) between 1 and 2000)
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

-- Quem está na conversa (fica fora da API pública).
create or replace function private.is_member(p_conversation uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation and user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_member(uuid) from public, anon;
grant execute on function private.is_member(uuid) to authenticated;

-- A outra pessoa da conversa.
create or replace function private.other_member(p_conversation uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select user_id from public.conversation_members
  where conversation_id = p_conversation and user_id <> (select auth.uid())
  limit 1;
$$;
revoke all on function private.other_member(uuid) from public, anon;
grant execute on function private.other_member(uuid) to authenticated;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy "conversas: membros veem" on public.conversations for select to authenticated
  using (private.is_member(id));

create policy "membros: veem a conversa" on public.conversation_members for select to authenticated
  using (private.is_member(conversation_id));
create policy "membros: marcar como lida" on public.conversation_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Só dá para mudar a hora de leitura.
revoke update on public.conversation_members from authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;

create policy "mensagens: membros leem" on public.messages for select to authenticated
  using (private.is_member(conversation_id));
create policy "mensagens: enviar" on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and kind in ('text', 'image', 'video')
    and (kind = 'text' or (media_path is not null and media_path like conversation_id::text || '/%'))
    and (poster_path is null or poster_path like conversation_id::text || '/%')
    and private.is_member(conversation_id)
    and not private.blocked_between((select auth.uid()), private.other_member(conversation_id))
  );
-- Sem apagar mensagem pelo app: uma mensagem denunciada não pode sumir antes da moderação.

-- "Lida até" usa o relógio do servidor e nunca volta no tempo.
create or replace function public.force_read_time()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.last_read_at := greatest(old.last_read_at, now());
  end if;
  return new;
end;
$$;
create trigger force_read_time before update on public.conversation_members
  for each row execute function public.force_read_time();

-- Data sempre do servidor; conversa sobe na lista.
create or replace function public.on_message_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at
   where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end;
$$;
create or replace function public.force_message_defaults()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.created_at := now();
  end if;
  return new;
end;
$$;
create trigger force_message_defaults before insert on public.messages
  for each row execute function public.force_message_defaults();
create trigger on_message_insert after insert on public.messages
  for each row execute function public.on_message_insert();

-- Abre (ou reaproveita) a conversa com outra pessoa.
create or replace function public.start_conversation(p_other uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  conv uuid;
begin
  if me is null or p_other is null or p_other = me then
    raise exception 'conversa_invalida';
  end if;
  if not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'pessoa_nao_encontrada';
  end if;
  if private.blocked_between(me, p_other) then
    raise exception 'bloqueado';
  end if;
  select a.conversation_id into conv
    from public.conversation_members a
    join public.conversation_members b on b.conversation_id = a.conversation_id
   where a.user_id = me and b.user_id = p_other
   limit 1;
  if conv is null then
    insert into public.conversations default values returning id into conv;
    insert into public.conversation_members (conversation_id, user_id) values (conv, me), (conv, p_other);
  end if;
  return conv;
end;
$$;
revoke all on function public.start_conversation(uuid) from public, anon;
grant execute on function public.start_conversation(uuid) to authenticated;

-- Lista de conversas com a última mensagem e quantas não foram lidas.
create or replace function public.my_conversations()
returns table (
  conversation_id uuid,
  other_id uuid,
  last_message_at timestamptz,
  last_kind text,
  last_body text,
  last_sender uuid,
  unread int,
  other_last_read_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select
    c.id,
    o.user_id,
    c.last_message_at,
    lm.kind,
    lm.body,
    lm.sender_id,
    (select count(*)::int from public.messages m
      where m.conversation_id = c.id and m.sender_id <> (select auth.uid()) and m.created_at > me.last_read_at),
    o.last_read_at
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  join public.conversation_members o on o.conversation_id = c.id and o.user_id <> me.user_id
  left join lateral (
    select kind, body, sender_id from public.messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = (select auth.uid())
  order by c.last_message_at desc;
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;

-- Denúncia de mensagem: o conteúdo vem do banco (não do app) e só quem está na conversa denuncia.
alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'user', 'comment', 'message'));
alter table public.reports add column media_path text;

create or replace function public.fill_message_report()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  m record;
  sender text;
begin
  if new.target_type <> 'message' then
    return new;
  end if;
  select msg.* into m
    from public.messages msg
   where msg.id::text = new.target_id
     and exists (select 1 from public.conversation_members cm
                  where cm.conversation_id = msg.conversation_id and cm.user_id = new.reporter_id);
  if not found then
    raise exception 'denuncia_invalida';
  end if;
  select username into sender from public.profiles where id = m.sender_id;
  new.details := format('Mensagem de @%s: %s', coalesce(sender, 'conta removida'),
    case m.kind when 'text' then '"' || coalesce(m.body, '') || '"' when 'image' then '[foto]' when 'video' then '[vídeo]' else '[mídia expirada]' end);
  new.media_path := case when m.kind = 'video' then coalesce(m.poster_path, m.media_path) else m.media_path end;
  return new;
end;
$$;
create trigger fill_message_report before insert on public.reports
  for each row execute function public.fill_message_report();

-- Moderador pode abrir só a foto/capa de mensagens denunciadas.
create policy "chat: moderador abre denunciada" on storage.objects for select to authenticated
  using (bucket_id = 'chat' and public.is_moderator() and exists (
    select 1 from public.reports r where r.target_type = 'message' and r.media_path = name
  ));

-- Moderador apaga uma mensagem denunciada.
create or replace function public.moderate_message(p_message uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_moderator() then raise exception 'sem_permissao'; end if;
  if not exists (select 1 from public.reports where target_type = 'message' and target_id = p_message::text) then
    raise exception 'sem_denuncia';
  end if;
  update public.messages set kind = 'expired', body = null, media_path = null, poster_path = null where id = p_message;
end;
$$;
revoke all on function public.moderate_message(uuid) from public, anon;
grant execute on function public.moderate_message(uuid) to authenticated;

-- Tempo real: mensagens novas e "visto".
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_members;

-- Pasta privada das conversas: <conversation_id>/<arquivo>. Só membros enviam e abrem.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', false, 20971520,
        array['image/webp', 'image/jpeg', 'image/png', 'video/webm', 'video/mp4'])
on conflict (id) do nothing;

create policy "chat: membros abrem" on storage.objects for select to authenticated
  using (bucket_id = 'chat' and exists (
    select 1 from public.conversation_members m
    where m.conversation_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid())
  ));
create policy "chat: quem enviou apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'chat' and owner_id = (select auth.uid())::text);
create policy "chat: membros enviam" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and exists (
    select 1 from public.conversation_members m
    where m.conversation_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid())
  ));
