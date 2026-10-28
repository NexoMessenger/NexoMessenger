-- NEXO Messenger — initial schema (Supabase / PostgreSQL)
-- Run in Supabase SQL Editor or via `supabase db push`.
-- Enables: profiles, direct conversations, groups, channels, posts,
-- attachments metadata, user settings, RLS, realtime, storage buckets.

create extension if not exists "pgcrypto";

-- ============ PROFILES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  display_name text not null default '',
  avatar_url text default '',
  bio text default '',
  is_online boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_profiles_username on public.profiles (username);
create index if not exists idx_profiles_display_name on public.profiles (lower(display_name));

-- ============ CONVERSATIONS (1-to-1) ============
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists idx_cm_user on public.conversation_members (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  attachment_url text default '',
  attachment_name text default '',
  attachment_type text default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_conv_time on public.messages (conversation_id, created_at);

-- ============ GROUPS ============
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_url text default '',
  description text default '',
  owner_id uuid not null references public.profiles(id) on delete cascade,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists idx_gm_user on public.group_members (user_id);
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  attachment_url text default '',
  attachment_name text default '',
  attachment_type text default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_gmsg_time on public.group_messages (group_id, created_at);

-- ============ CHANNELS ============
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_url text default '',
  description text default '',
  owner_id uuid not null references public.profiles(id) on delete cascade,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.channel_members (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'subscriber' check (role in ('owner','admin','subscriber')),
  can_post boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists idx_chm_user on public.channel_members (user_id);
create table if not exists public.channel_posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  attachment_url text default '',
  attachment_name text default '',
  attachment_type text default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_posts_time on public.channel_posts (channel_id, created_at);

-- ============ ATTACHMENTS + SETTINGS ============
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text default '',
  size_bytes bigint default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'nexoglass' check (theme in ('nexoglass','midnight','graphite')),
  notifications_enabled boolean not null default true,
  privacy_profile text not null default 'public' check (privacy_profile in ('public','private')),
  updated_at timestamptz not null default now()
);

-- ============ HELPERS (avoid recursive RLS) ============
create or replace function public.is_conv_member(cid uuid) returns boolean
language sql security definer stable as $$
  select exists(select 1 from public.conversation_members where conversation_id = cid and user_id = auth.uid());
$$;
create or replace function public.is_group_member(gid uuid) returns boolean
language sql security definer stable as $$
  select exists(select 1 from public.group_members where group_id = gid and user_id = auth.uid());
$$;
create or replace function public.is_group_admin(gid uuid) returns boolean
language sql security definer stable as $$
  select exists(select 1 from public.group_members where group_id = gid and user_id = auth.uid() and role in ('owner','admin'));
$$;
create or replace function public.is_channel_member(chid uuid) returns boolean
language sql security definer stable as $$
  select exists(select 1 from public.channel_members where channel_id = chid and user_id = auth.uid());
$$;
create or replace function public.can_post_to_channel(chid uuid) returns boolean
language sql security definer stable as $$
  select exists(select 1 from public.channel_members m join public.channels c on c.id = m.channel_id
    where m.channel_id = chid and m.user_id = auth.uid() and (m.role in ('owner','admin') or m.can_post or c.owner_id = auth.uid()));
$$;

-- ============ ROW LEVEL SECURITY ============
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;
alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.channel_posts enable row level security;
alter table public.attachments enable row level security;
alter table public.user_settings enable row level security;

create policy "profiles readable" on public.profiles for select using (true);
create policy "profiles update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = id);

create policy "conv read member" on public.conversations for select using (public.is_conv_member(id));
create policy "conv create auth" on public.conversations for insert with check (auth.uid() is not null);
create policy "cm read member" on public.conversation_members for select using (public.is_conv_member(conversation_id) or user_id = auth.uid());
create policy "cm insert" on public.conversation_members for insert with check (auth.uid() is not null);
create policy "cm update own" on public.conversation_members for update using (user_id = auth.uid());
create policy "msg read member" on public.messages for select using (public.is_conv_member(conversation_id));
create policy "msg insert member" on public.messages for insert with check (public.is_conv_member(conversation_id) and sender_id = auth.uid());
create policy "msg update own read" on public.messages for update using (public.is_conv_member(conversation_id));

create policy "groups read" on public.groups for select using (is_public or public.is_group_member(id) or owner_id = auth.uid());
create policy "groups create" on public.groups for insert with check (owner_id = auth.uid());
create policy "groups update owner/admin" on public.groups for update using (owner_id = auth.uid() or public.is_group_admin(id));
create policy "gm read" on public.group_members for select using (public.is_group_member(group_id) or user_id = auth.uid());
create policy "gm insert member-or-admin" on public.group_members for insert with check (auth.uid() is not null and (user_id = auth.uid() or public.is_group_admin(group_id)));
create policy "gm delete self-or-admin" on public.group_members for delete using (user_id = auth.uid() or public.is_group_admin(group_id));
create policy "gm update admin" on public.group_members for update using (public.is_group_admin(group_id));
create policy "gmsg read member" on public.group_messages for select using (public.is_group_member(group_id));
create policy "gmsg insert member" on public.group_messages for insert with check (public.is_group_member(group_id) and sender_id = auth.uid());

create policy "channels read" on public.channels for select using (is_public or public.is_channel_member(id) or owner_id = auth.uid());
create policy "channels create" on public.channels for insert with check (owner_id = auth.uid());
create policy "channels update owner/admin" on public.channels for update using (owner_id = auth.uid() or exists(select 1 from public.channel_members where channel_id = id and user_id = auth.uid() and role in ('owner','admin')));
create policy "chm read" on public.channel_members for select using (public.is_channel_member(channel_id) or user_id = auth.uid());
create policy "chm insert self-or-poster" on public.channel_members for insert with check (auth.uid() is not null and (user_id = auth.uid() or public.can_post_to_channel(channel_id)));
create policy "chm delete self-or-poster" on public.channel_members for delete using (user_id = auth.uid() or public.can_post_to_channel(channel_id));
create policy "chm update poster" on public.channel_members for update using (public.can_post_to_channel(channel_id));
create policy "posts read public-or-member" on public.channel_posts for select using (
  exists(select 1 from public.channels c where c.id = channel_id and c.is_public) or public.is_channel_member(channel_id));
create policy "posts insert authorized" on public.channel_posts for insert with check (public.can_post_to_channel(channel_id) and author_id = auth.uid());
create policy "posts delete author-or-owner" on public.channel_posts for delete using (author_id = auth.uid());

create policy "att read own" on public.attachments for select using (owner_id = auth.uid());
create policy "att insert own" on public.attachments for insert with check (owner_id = auth.uid());
create policy "settings own" on public.user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Auto-create profile row on signup (username/display from user_metadata, fallback generated)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare uname text;
begin
  uname := lower(coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text,1,8)));
  insert into public.profiles (id, username, display_name, avatar_url)
  values (new.id, uname, coalesce(new.raw_user_meta_data->>'display_name', uname), coalesce(new.raw_user_meta_data->>'avatar_url',''))
  on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  return new;
exception when unique_violation then
  insert into public.profiles (id, username, display_name)
  values (new.id, 'user_' || substr(new.id::text,1,8), coalesce(new.raw_user_meta_data->>'display_name','NEXO User'))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Realtime
alter publication supabase_realtime add table public.messages, public.group_messages, public.channel_posts, public.profiles;

-- Storage buckets (run once; also create in Dashboard > Storage if this fails on your plan)
insert into storage.buckets (id, name, public) values ('attachments','attachments', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars','avatars', true) on conflict (id) do nothing;
create policy "attachments read own folder" on storage.objects for select using (bucket_id='attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "attachments write own folder" on storage.objects for insert with check (bucket_id='attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars public read" on storage.objects for select using (bucket_id='avatars');
create policy "avatars write own folder" on storage.objects for insert with check (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
