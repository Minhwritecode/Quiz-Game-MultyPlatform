-- Only the verified Edge Function may consume quota; clients cannot reset it.
create table public.papybot_usage (
 user_id uuid not null references auth.users(id) on delete cascade,
 usage_day date not null,
 calls integer not null check (calls between 1 and 30),
 primary key (user_id, usage_day)
);
alter table public.papybot_usage enable row level security;
revoke all on public.papybot_usage from anon, authenticated;
grant select, insert, update on public.papybot_usage to service_role;
create function public.consume_papybot_quota(p_user uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare consumed integer;
begin
 insert into public.papybot_usage(user_id,usage_day,calls)
 values(p_user,(now() at time zone 'UTC')::date,1)
 on conflict(user_id,usage_day) do update set calls=public.papybot_usage.calls+1
 where public.papybot_usage.calls<30 returning calls into consumed;
 return consumed is not null;
end;
$$;
revoke all on function public.consume_papybot_quota(uuid) from public,anon,authenticated;
grant execute on function public.consume_papybot_quota(uuid) to service_role;
