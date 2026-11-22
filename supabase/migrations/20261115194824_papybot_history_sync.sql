create table public.papybot_conversations (
 owner_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null,
 messages jsonb not null check(jsonb_typeof(messages)='array' and jsonb_array_length(messages)<=20 and octet_length(messages::text)<=400000),
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 deleted boolean not null default false,
 primary key(owner_id,id)
);
alter table public.papybot_conversations enable row level security;
create policy "own chat history" on public.papybot_conversations for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
grant select,insert,update on public.papybot_conversations to authenticated;
create function public.save_papybot_conversation(p_id uuid,p_messages jsonb,p_revision integer,p_deleted boolean default false)
returns integer language plpgsql security invoker set search_path='' as $$
declare next_revision integer;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_revision=0 then
   insert into public.papybot_conversations(owner_id,id,messages,deleted) values(auth.uid(),p_id,p_messages,p_deleted)
   on conflict do nothing returning revision into next_revision;
 else
   update public.papybot_conversations set messages=p_messages,deleted=p_deleted,revision=revision+1,updated_at=now()
   where owner_id=auth.uid() and id=p_id and revision=p_revision returning revision into next_revision;
 end if;
 if next_revision is null then raise exception 'CHAT_CONFLICT'; end if;
 return next_revision;
end;
$$;
revoke all on function public.save_papybot_conversation(uuid,jsonb,integer,boolean) from public,anon;
grant execute on function public.save_papybot_conversation(uuid,jsonb,integer,boolean) to authenticated;
