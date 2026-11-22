-- Auth owns identity/email/credentials. Public profile data follows Auth metadata,
-- including the existing updateDisplayName flow; never copy passwords or tokens.
alter table public.profiles add column updated_at timestamptz not null default now();
comment on table public.profiles is 'App display profile, maintained from auth.users. Credentials remain in Auth.';

drop policy "profiles are readable" on public.profiles;
drop policy "users manage own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- Room/leaderboard SECURITY DEFINER RPCs expose only the required display name.

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  language text not null default 'vi' check (language in ('vi', 'en')),
  haptics boolean not null default true,
  reduce_motion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.user_preferences is 'Account preferences. Device OS notification permissions and tokens are not stored here.';
alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from anon, authenticated;
grant select on public.user_preferences to authenticated;
grant update(theme, language, haptics, reduce_motion) on public.user_preferences to authenticated;
create policy "read own preferences" on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy "update own preferences" on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function private.touch_user_preferences()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_user_preferences() from public, anon, authenticated;
create trigger user_preferences_updated before update on public.user_preferences
for each row execute function private.touch_user_preferences();

-- Trigger uses elevated rights only to provision the row for NEW.id supplied by Auth.
-- It is private, not exposed as an RPC, and does not trust metadata for authorization.
create function private.sync_auth_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  profile_name text;
  profile_avatar text;
begin
  profile_name := left(coalesce(
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'display_name'), ''), 'Learner'), 60);
  profile_avatar := coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture');
  if profile_avatar !~ '^https://' or length(profile_avatar) > 2048 then profile_avatar := null; end if;
  insert into public.profiles(id, display_name, avatar_url, created_at, updated_at)
  values(new.id, profile_name, profile_avatar, coalesce(new.created_at, now()), now())
  on conflict(id) do update set display_name=excluded.display_name,
    avatar_url=excluded.avatar_url, updated_at=excluded.updated_at;
  insert into public.user_preferences(user_id) values(new.id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.sync_auth_profile() from public, anon, authenticated;
create trigger auth_profile_created after insert on auth.users
for each row execute function private.sync_auth_profile();
create trigger auth_profile_changed after update of raw_user_meta_data on auth.users
for each row when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
execute function private.sync_auth_profile();

-- Backfill existing accounts without overwriting already curated display profiles.
insert into public.profiles(id, display_name, avatar_url, created_at)
select u.id, left(coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
  nullif(btrim(u.raw_user_meta_data->>'name'), ''),
  nullif(btrim(u.raw_user_meta_data->>'display_name'), ''), 'Learner'), 60),
  case when coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture') ~ '^https://'
    and length(coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')) <= 2048
    then coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture') else null end,
  coalesce(u.created_at, now())
from auth.users u on conflict(id) do nothing;
insert into public.user_preferences(user_id) select id from auth.users on conflict do nothing;
