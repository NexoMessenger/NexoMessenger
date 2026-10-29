-- Allow the expanded appearance themes in user settings.
-- Keeps the original themes valid and adds Lime, Light, Coffee,
-- Sakura, Ocean, and Sunset.

alter table public.user_settings
  drop constraint if exists user_settings_theme_check;

alter table public.user_settings
  add constraint user_settings_theme_check
  check (theme in (
    'nexoglass',
    'midnight',
    'graphite',
    'lime',
    'light',
    'coffee',
    'sakura',
    'ocean',
    'sunset'
  ));
