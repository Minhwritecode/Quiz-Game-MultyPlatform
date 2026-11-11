-- A transferred host may still have a room referencing the departing owner's set.
-- Remove that room before the owner's set cascades; otherwise ON DELETE RESTRICT
-- prevents Auth from deleting the account. All cleanup is in the Auth transaction.
create or replace function private.cleanup_account_rooms()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.rooms r
  where r.host_id = old.id
     or r.set_id in (select s.id from public.question_sets s where s.owner_id = old.id);
  return old;
end;
$$;
revoke all on function private.cleanup_account_rooms() from public, anon, authenticated;
create trigger cleanup_account_rooms_before_delete
before delete on auth.users for each row execute function private.cleanup_account_rooms();
