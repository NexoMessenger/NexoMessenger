-- NEXO Messenger — reactions, media durations, sticker packs (additive only)
-- Existing users/messages/conversations are preserved. Media binaries live in
-- the existing private Storage bucket `attachments` (see 001); only metadata
-- and signed/public references are stored in message rows.

alter table public.messages add column if not exists attachment_duration integer not null default 0;
alter table public.group_messages add column if not exists attachment_duration integer not null default 0;

-- ============ MESSAGE REACTIONS (one per user per message) ============
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('direct','group')),
  conversation_id uuid not null,
  message_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);
create index if not exists idx_reactions_conv on public.message_reactions (conversation_id);
create index if not exists idx_reactions_msg on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;
create policy "reactions read members" on public.message_reactions for select using (
  (scope = 'direct' and public.is_conv_member(conversation_id)) or
  (scope = 'group' and public.is_group_member(conversation_id))
);
create policy "reactions write own" on public.message_reactions for insert with check (
  user_id = auth.uid() and (
    (scope = 'direct' and public.is_conv_member(conversation_id)) or
    (scope = 'group' and public.is_group_member(conversation_id))
  )
);
create policy "reactions update own" on public.message_reactions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reactions delete own" on public.message_reactions for delete using (user_id = auth.uid());

-- ============ STICKER PACKS (extensible registry; assets ship with the app) ============
create table if not exists public.sticker_packs (
  id text primary key,
  name text not null,
  author text not null default 'NEXO',
  created_at timestamptz not null default now()
);
create table if not exists public.stickers (
  id text primary key,
  pack_id text not null references public.sticker_packs(id) on delete cascade,
  name text not null,
  asset_key text not null,
  sort integer not null default 0
);
alter table public.sticker_packs enable row level security;
alter table public.stickers enable row level security;
create policy "sticker packs public read" on public.sticker_packs for select using (true);
create policy "stickers public read" on public.stickers for select using (true);

insert into public.sticker_packs (id, name, author) values ('nexo-fox', 'NEXO Fox', 'NEXO')
on conflict (id) do nothing;
insert into public.stickers (id, pack_id, name, asset_key, sort) values
  ('fox-happy','nexo-fox','Happy fox','happy',1),
  ('fox-laugh','nexo-fox','Laughing fox','laugh',2),
  ('fox-sad','nexo-fox','Sad fox','sad',3),
  ('fox-angry','nexo-fox','Angry fox','angry',4),
  ('fox-surprised','nexo-fox','Surprised fox','surprised',5),
  ('fox-love','nexo-fox','Love-struck fox','love',6),
  ('fox-wave','nexo-fox','Fox waving hello','wave',7),
  ('fox-bye','nexo-fox','Fox saying goodbye','bye',8),
  ('fox-sleepy','nexo-fox','Sleepy fox','sleepy',9),
  ('fox-thumbsup','nexo-fox','Thumbs-up fox','thumbsup',10),
  ('fox-thanks','nexo-fox','Fox saying thanks','thanks',11),
  ('fox-celebrate','nexo-fox','Fox celebrating','celebrate',12),
  ('fox-confused','nexo-fox','Confused fox','confused',13),
  ('fox-facepalm','nexo-fox','Facepalm fox','facepalm',14),
  ('fox-heart','nexo-fox','Fox sending a heart','heart',15),
  ('fox-cool','nexo-fox','Cool fox with sunglasses','cool',16)
on conflict (id) do nothing;

-- Realtime for reactions
alter publication supabase_realtime add table public.message_reactions;
