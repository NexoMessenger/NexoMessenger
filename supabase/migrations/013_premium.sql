-- NEXO Premium (run AFTER 007; safe to re-run).
-- Premium costs 100 RUB per 30 days and is activated with a one-time code:
-- the buyer pays the NEXO admin and receives a code. There is no card
-- gateway in the app, so codes are the honest sales channel. Codes stack:
-- redeeming while active adds the days to the current end date.
-- Mirrors src/lib/premiumData.ts PREMIUM_CODES; keep in sync.

alter table public.profiles
  add column if not exists premium_until timestamptz,
  add column if not exists emoji_status text not null default '',
  add column if not exists worn_gift jsonb,
  add column if not exists name_color text not null default '',
  add column if not exists business jsonb;

create table if not exists public.premium_codes (
  code text primary key,
  days integer not null check (days > 0),
  redeemed_by uuid references public.profiles(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.premium_codes enable row level security;
-- No policies on purpose: the table is invisible to clients;
-- redeem_premium_code is the only door and re-checks everything.

create or replace function public.redeem_premium_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); rec public.premium_codes; v_norm text;
        v_until timestamptz;
begin
  if v_uid is null then raise exception 'Session expired. Please sign in again.'; end if;
  v_norm := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_norm = '' then raise exception 'Invalid code.'; end if;
  select * into rec from public.premium_codes
    where upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')) = v_norm
    for update;
  if rec.code is null then raise exception 'Invalid code.'; end if;
  if rec.redeemed_by is not null then raise exception 'This code has already been used.'; end if;
  select greatest(coalesce(premium_until, now()), now()) + (rec.days || ' days')::interval
    into v_until from public.profiles where id = v_uid;
  update public.profiles set premium_until = v_until where id = v_uid;
  update public.premium_codes set redeemed_by = v_uid, redeemed_at = now()
    where code = rec.code;
  return jsonb_build_object('until', v_until, 'days', rec.days);
end $$;

grant execute on function public.redeem_premium_code(text) to authenticated;

insert into public.premium_codes (code, days) values
  ('NEXO-PRO-A7K9', 30), ('NEXO-PRO-M3QX', 30),
  ('NEXO-PRO-T8WD', 30), ('NEXO-PRO-Z4HP', 30),
  ('NEXO-PRO-K6SN', 30), ('NEXO-PRO-D9VC', 30),
  ('NEXO-PRO-R2MB', 30), ('NEXO-PRO-F5XJ', 30),
  ('NEXO-PRO-Q7GT', 30), ('NEXO-PRO-W4NA', 30)
on conflict (code) do nothing;
