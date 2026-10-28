-- 004_cross_user_sync.sql
-- Connectivity insurance for real multi-user mode (Supabase).
-- Guarantees the three things friends need to find and see each other:
--   1) profiles are readable by everyone (people search by name/@username),
--   2) group members can read group messages,
--   3) the realtime publication includes the chat tables (live delivery).
-- Idempotent: safe to run after 001-003, and safe to run more than once.

-- 1) People search: profiles readable (only public profile fields live here;
--    email/passwords are in auth.users and are never exposed by this policy).
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'profiles') then
    execute 'drop policy if exists "profiles readable" on public.profiles';
    execute 'create policy "profiles readable" on public.profiles for select using (true)';
  end if;
end $$;

-- 2) Group visibility: members read members list + group messages.
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'group_members') then
    execute 'drop policy if exists "gm read" on public.group_members';
    execute 'create policy "gm read" on public.group_members for select using (public.is_group_member(group_id) or user_id = auth.uid())';
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'group_messages') then
    execute 'drop policy if exists "gmsg read member" on public.group_messages';
    execute 'create policy "gmsg read member" on public.group_messages for select using (public.is_group_member(group_id))';
    execute 'drop policy if exists "gmsg insert member" on public.group_messages';
    execute 'create policy "gmsg insert member" on public.group_messages for insert with check (public.is_group_member(group_id) and sender_id = auth.uid())';
  end if;
end $$;

-- 3) Realtime: make sure chat tables are in the supabase_realtime publication
--    (adding an already-present table would otherwise error and abort setup).
do $$
declare t text;
begin
  foreach t in array array['messages','group_messages','channel_posts','profiles','message_reactions'] loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t)
       and exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
