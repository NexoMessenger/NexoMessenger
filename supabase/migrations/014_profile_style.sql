-- NEXO Premium profile styling (run AFTER 013; safe to re-run).
-- Floating background gifts, profile music, name font and profile theme
-- live on the profile row so every client sees the same decorations.

alter table public.profiles
  add column if not exists bg_gifts jsonb not null default '[]'::jsonb,
  add column if not exists profile_music jsonb,
  add column if not exists profile_font text not null default 'default',
  add column if not exists profile_theme text not null default 'default';
