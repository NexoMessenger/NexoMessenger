-- Message actions: replies, edits, deletes (run AFTER 001–007; re-runnable).
-- Adds quote/edit metadata and sender-scoped update/delete policies.

alter table public.messages add column if not exists reply_to uuid;
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.group_messages add column if not exists reply_to uuid;
alter table public.group_messages add column if not exists edited_at timestamptz;

-- 001's "msg update own read" allowed ANY conversation member to update a
-- message; replace it with a strict sender-only rule, and add delete.
drop policy if exists "msg update own read" on public.messages;
drop policy if exists "msg update own" on public.messages;
create policy "msg update own" on public.messages for update
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());
drop policy if exists "msg delete own" on public.messages;
create policy "msg delete own" on public.messages for delete
  using (sender_id = auth.uid());

drop policy if exists "gmsg update own" on public.group_messages;
create policy "gmsg update own" on public.group_messages for update
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());
drop policy if exists "gmsg delete own" on public.group_messages;
create policy "gmsg delete own" on public.group_messages for delete
  using (sender_id = auth.uid());
