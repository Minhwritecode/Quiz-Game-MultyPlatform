-- Aggregate only server-scored, completed battles. Never use client attempt scores.
create index if not exists rooms_finished_idx on public.rooms(id) where status='finished';
create function public.battle_leaderboard(p_offset integer default 0)
returns table(rank bigint,display_name text,points bigint,matches bigint,is_me boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if p_offset<0 or p_offset>10000 then raise exception 'Invalid offset';end if;
 return query
 with totals as (
 select rp.user_id,sum(rp.score)::bigint as points,count(*) as matches
 from public.room_players rp join public.rooms r on r.id=rp.room_id
 where r.status='finished' group by rp.user_id
 ), ranked as (
 select row_number() over(order by t.points desc,t.matches desc,t.user_id) as ranking,t.* from totals t
 )
 select r.ranking,coalesce(p.display_name,'Learner'),r.points,r.matches,r.user_id=auth.uid()
 from ranked r left join public.profiles p on p.id=r.user_id order by r.ranking limit 25 offset p_offset;
end;
$$;
revoke all on function public.battle_leaderboard(integer) from public,anon;
grant execute on function public.battle_leaderboard(integer) to authenticated;
