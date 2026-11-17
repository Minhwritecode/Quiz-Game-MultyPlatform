\set ON_ERROR_STOP on
begin;
insert into auth.users (id,email) values
 ('11111111-2222-4333-8444-555555555501','delete-owner@papyrus.test'),
 ('11111111-2222-4333-8444-555555555502','remaining@papyrus.test');
insert into public.question_sets(id,owner_id,title) values
 ('22222222-2222-4333-8444-555555555501','11111111-2222-4333-8444-555555555501','Deleted owner set'),
 ('22222222-2222-4333-8444-555555555502','11111111-2222-4333-8444-555555555502','Other set');
insert into public.rooms(code,host_id,set_id,question_count,seconds_per_question) values
 ('DEL001','11111111-2222-4333-8444-555555555502','22222222-2222-4333-8444-555555555501',1,15),
 ('KEEP01','11111111-2222-4333-8444-555555555502','22222222-2222-4333-8444-555555555502',1,15);
delete from auth.users where id='11111111-2222-4333-8444-555555555501';
do $$ begin
 if exists(select 1 from public.question_sets where id='22222222-2222-4333-8444-555555555501') then raise exception 'Owner data survived'; end if;
 if exists(select 1 from public.rooms where code='DEL001') then raise exception 'Transferred room survived'; end if;
 if not exists(select 1 from public.rooms where code='KEEP01') then raise exception 'Unrelated room deleted'; end if;
 if not exists(select 1 from auth.users where id='11111111-2222-4333-8444-555555555502') then raise exception 'Other user deleted'; end if;
 if has_function_privilege('anon','private.cleanup_account_rooms()','execute') or has_function_privilege('authenticated','private.cleanup_account_rooms()','execute') then raise exception 'Cleanup exposed to clients'; end if;
end $$;
rollback;
