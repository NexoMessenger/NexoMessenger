-- NEXO promo codes (run AFTER 005; safe to re-run).
-- Gift-card style: every code can be redeemed exactly once, by any account,
-- only inside the SECURITY DEFINER function below. Clients get no direct
-- access to the table at all (codes are secrets).

create table if not exists public.promo_codes (
  code text primary key,
  amount integer not null check (amount > 0),
  redeemed_by uuid references public.profiles(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.promo_codes enable row level security;
-- No policies on purpose: the table is invisible to clients; redeem_promo
-- is the only door, and it re-checks everything server-side.

create or replace function public.redeem_promo(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); w public.gift_wallets;
        rec public.promo_codes; v_norm text;
begin
  if v_uid is null then raise exception 'Session expired. Please sign in again.'; end if;
  v_norm := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_norm = '' then raise exception 'Invalid code.'; end if;
  select * into rec from public.promo_codes
    where upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')) = v_norm
    for update;
  if rec.code is null then raise exception 'Invalid code.'; end if;
  if rec.redeemed_by is not null then raise exception 'This code has already been used.'; end if;
  perform public.gift_ensure_wallet();
  update public.gift_wallets set balance = balance + rec.amount
    where user_id = v_uid returning * into w;
  update public.promo_codes set redeemed_by = v_uid, redeemed_at = now()
    where code = rec.code;
  insert into public.gift_transactions (user_id, kind, amount, note)
    values (v_uid, 'promo', rec.amount, 'Promo code');
  return jsonb_build_object('amount', rec.amount, 'balance', w.balance);
end $$;

grant execute on function public.redeem_promo(text) to authenticated;

-- Seed (mirrors src/lib/giftData.ts PROMO_CODES; keep in sync).
insert into public.promo_codes (code, amount) values
  ('NEXO-MEGA-K7Q2', 10000), ('NEXO-MEGA-R4XD', 10000),
  ('NEXO-STAR-P9TA', 5000), ('NEXO-STAR-W3KE', 5000),
  ('NEXO-MOON-D8ZH', 2500), ('NEXO-MOON-B6NF', 2500),
  ('NEXO-GIFT-X2QR', 1000), ('NEXO-GIFT-M5VC', 1000),
  ('NEXO-GIFT-T9HA', 1000), ('NEXO-GIFT-K4JW', 1000),
  ('NEXO-BONUS-S7PD', 500), ('NEXO-BONUS-F2YG', 500),
  ('NEXO-BONUS-Q8ME', 500), ('NEXO-BONUS-H3XT', 500)
on conflict (code) do nothing;
