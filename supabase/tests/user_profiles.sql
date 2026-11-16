-- Run as administrator; everything, including fixture accounts, rolls back.
begin;
insert into auth.users(id, raw_user_meta_data) values
 ('bafe0000-0000-4000-8000-000000000001', '{"full_name":"Alice","avatar_url":"https://example.com/avatar.png"}'),
 ('bafe0000-0000-4000-8000-000000000002', '{}');
do $$ begin
 if (select display_name from public.profiles where id='bafe0000-0000-4000-8000-000000000001') <> 'Alice' then raise exception 'Profile not provisioned'; end if;
 if (select count(*) from public.user_preferences where user_id in ('bafe0000-0000-4000-8000-000000000001','bafe0000-0000-4000-8000-000000000002')) <> 2 then raise exception 'Preferences missing'; end if;
end $$;
update auth.users set raw_user_meta_data='{"full_name":"Alice Updated","avatar_url":"javascript:bad"}' where id='bafe0000-0000-4000-8000-000000000001';
do $$ begin
 if not exists(select 1 from public.profiles where id='bafe0000-0000-4000-8000-000000000001' and display_name='Alice Updated' and avatar_url is null) then raise exception 'Metadata sync failed'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','bafe0000-0000-4000-8000-000000000001',true);
do $$ declare changed integer; begin
 if (select count(*) from public.profiles) <> 1 then raise exception 'Profile RLS leak'; end if;
 if (select count(*) from public.user_preferences) <> 1 then raise exception 'Preferences RLS leak'; end if;
 update public.user_preferences set theme='dark' where user_id='bafe0000-0000-4000-8000-000000000001';
 get diagnostics changed = row_count;
 if changed <> 1 then raise exception 'Own preference update blocked'; end if;
 update public.user_preferences set theme='light' where user_id='bafe0000-0000-4000-8000-000000000002';
 get diagnostics changed = row_count;
 if changed <> 0 then raise exception 'Cross-user update allowed'; end if;
 begin
   update public.profiles set display_name='forged';
   raise exception 'Direct profile mutation allowed';
 exception when insufficient_privilege then null; end;
 begin
   update public.user_preferences set theme='invalid';
   raise exception 'Invalid preference allowed';
 exception when check_violation then null; end;
 if has_function_privilege('authenticated','private.sync_auth_profile()','execute') then raise exception 'Trigger exposed'; end if;
end $$;
reset role;
delete from auth.users where id='bafe0000-0000-4000-8000-000000000001';
do $$ begin
 if exists(select 1 from public.profiles where id='bafe0000-0000-4000-8000-000000000001') or exists(select 1 from public.user_preferences where user_id='bafe0000-0000-4000-8000-000000000001') then raise exception 'Account cascade failed'; end if;
 if not exists(select 1 from public.profiles where id='bafe0000-0000-4000-8000-000000000002') then raise exception 'Other profile deleted'; end if;
 if has_table_privilege('anon','public.profiles','select') or has_table_privilege('anon','public.user_preferences','select') then raise exception 'Anonymous data access'; end if;
end $$;
rollback;
