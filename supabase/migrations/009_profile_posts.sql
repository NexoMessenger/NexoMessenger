-- Profile publications: photo/video/text posts on user profiles.
-- Run AFTER 001–008. Re-runnable.

create table if not exists public.profile_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  attachment_url text not null default '',
  attachment_name text not null default '',
  attachment_type text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists profile_posts_user_idx on public.profile_posts (user_id, created_at desc);

alter table public.profile_posts enable row level security;

-- Public posts are readable by everyone; archived ones only by their owner.
drop policy if exists "profile posts read" on public.profile_posts;
create policy "profile posts read" on public.profile_posts for select
  using (archived = false or user_id = auth.uid());
drop policy if exists "profile posts insert own" on public.profile_posts;
create policy "profile posts insert own" on public.profile_posts for insert
  with check (user_id = auth.uid());
drop policy if exists "profile posts update own" on public.profile_posts;
create policy "profile posts update own" on public.profile_posts for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "profile posts delete own" on public.profile_posts;
create policy "profile posts delete own" on public.profile_posts for delete
  using (user_id = auth.uid());
