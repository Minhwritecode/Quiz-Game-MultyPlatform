alter table public.room_players add column ready boolean not null default false;
alter table public.room_players add column last_seen_at timestamptz not null default now();

create or replace function public.battle_start(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.rooms%rowtype; n integer; t timestamptz := clock_timestamp()+interval '3 seconds';
begin
 select * into r from public.rooms where id=target for update;
 if auth.uid() is null or r.host_id is distinct from auth.uid() then raise exception 'host_required' using errcode='42501'; end if;
 if r.status <> 'waiting' then raise exception 'already_started'; end if;
 select count(*) into n from public.room_players where room_id=target;
 if n not between 2 and 4 or exists(select 1 from public.room_players where room_id=target and (not ready or last_seen_at < clock_timestamp()-interval '30 seconds')) then raise exception 'players_not_ready'; end if;
 insert into public.room_questions(room_id,position,question_snapshot,opens_at,closes_at)
 select target, (row_number() over(order by q.position,q.id)-1)::integer,
 jsonb_build_object('content',q.content,'options',q.options,'correct_index',q.correct_index,'explanation',q.explanation),
 t+(row_number() over(order by q.position,q.id)-1)*(r.seconds_per_question+3)*interval '1 second',
 t+((row_number() over(order by q.position,q.id)-1)*(r.seconds_per_question+3)+r.seconds_per_question)*interval '1 second'
 from public.questions q where q.set_id=r.set_id and not q.is_deleted order by q.position,q.id limit r.question_count;
 get diagnostics n = row_count;
 if n=0 then raise exception 'empty_question_set'; end if;
 update public.rooms set status='countdown',started_at=t,question_count=n where id=target;
end $$;

create or replace function public.battle_heartbeat(target uuid, p_ready boolean default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not private.is_room_member(target) then raise exception 'membership_required' using errcode='42501'; end if;
 update public.room_players set last_seen_at=clock_timestamp(),connected=true,ready=coalesce(p_ready,ready)
 where room_id=target and user_id=auth.uid();
end $$;

-- The read computes state from fixed server deadlines, so no browser timer owns transitions.
create or replace function public.battle_snapshot(target uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.rooms%rowtype; q public.room_questions%rowtype; phase text; roster jsonb;
 t timestamptz := clock_timestamp(); next_host uuid; question jsonb;
begin
 if not private.is_room_member(target) then raise exception 'membership_required' using errcode='42501'; end if;
 select * into r from public.rooms where id=target for update;
 if not exists(select 1 from public.room_players where room_id=target and user_id=r.host_id and last_seen_at>=t-interval '30 seconds') then
   select user_id into next_host from public.room_players where room_id=target and last_seen_at>=t-interval '30 seconds' order by joined_at,user_id limit 1;
   if next_host is not null then update public.rooms set host_id=next_host where id=target; r.host_id:=next_host; end if;
 end if;
 phase:=r.status;
 if r.started_at is not null then
   select * into q from public.room_questions where room_id=target and opens_at<=t order by position desc limit 1;
   phase:=case when t<r.started_at then 'countdown' when q.position=r.question_count-1 and t>=q.closes_at+interval '3 seconds' then 'finished' when t<q.closes_at then 'question_open' else 'question_result' end;
   if phase<>r.status then update public.rooms set status=phase where id=target; end if;
   if q.room_id is not null then
     question:=jsonb_build_object('position',q.position,'closesAt',q.closes_at,'content',q.question_snapshot->'content','options',q.question_snapshot->'options');
     if t>=q.closes_at then question:=question||jsonb_build_object('correctIndex',q.question_snapshot->'correct_index','explanation',q.question_snapshot->'explanation'); end if;
   end if;
 end if;
 select jsonb_agg(jsonb_build_object('userId',p.user_id,'name',coalesce(pr.display_name,'Learner'),'score',p.score,'ready',p.ready,'connected',p.last_seen_at>=t-interval '30 seconds') order by p.score desc,p.joined_at,p.user_id)
 into roster from public.room_players p left join public.profiles pr on pr.id=p.user_id where p.room_id=target;
 return jsonb_build_object('id',r.id,'code',r.code,'hostId',r.host_id,'phase',phase,'serverTime',t,'players',roster,'question',question,
 'answered',exists(select 1 from public.room_answers where room_id=target and user_id=auth.uid() and position=q.position));
end $$;

create or replace function public.battle_leave(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not private.is_room_member(target) then raise exception 'membership_required' using errcode='42501'; end if;
 perform 1 from public.rooms where id=target for update;
 update public.room_players set last_seen_at=clock_timestamp()-interval '31 seconds',connected=false,ready=false where room_id=target and user_id=auth.uid();
 -- Keep historical scores/membership in running games; waiting seats can be reclaimed.
 if exists(select 1 from public.rooms where id=target and status='waiting') then
   delete from public.room_players where room_id=target and user_id=auth.uid();
 end if;
end $$;
revoke all on function public.battle_start(uuid), public.battle_snapshot(uuid), public.battle_heartbeat(uuid,boolean), public.battle_leave(uuid) from public,anon;
grant execute on function public.battle_start(uuid), public.battle_snapshot(uuid), public.battle_heartbeat(uuid,boolean), public.battle_leave(uuid) to authenticated;
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='room_players') then alter publication supabase_realtime add table public.room_players; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='rooms') then alter publication supabase_realtime add table public.rooms; end if;
end $$;
