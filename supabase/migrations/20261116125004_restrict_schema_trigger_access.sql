-- Supabase Studio may install this helper on hosted projects; local stacks may
-- not have it. It is a DDL event trigger, never an application RPC.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='rls_auto_enable' and p.pronargs=0
      and p.prorettype='event_trigger'::regtype
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
