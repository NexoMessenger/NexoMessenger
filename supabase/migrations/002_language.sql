-- NEXO Messenger — persist interface language per account (i18n sync)
alter table public.user_settings
  add column if not exists language text not null default 'en'
  check (language in ('en', 'ru', 'uk', 'zh-CN'));
