-- NEXO Gifts & NEX marketplace (run AFTER 001–004; safe to re-run).
--
-- Design: clients may only READ (their own wallet/inventory/history; the
-- public catalog, items and listings). Every balance/ownership change runs
-- inside a SECURITY DEFINER function that re-checks ownership, listing
-- state and balance server-side — the frontend can never set a balance,
-- a price of record, or a seller identity. NEX is a virtual in-app
-- currency with no real-world value.

create table if not exists public.gift_models (
  key text primary key,
  kind text not null check (kind in ('collectible', 'regular')),
  collection text not null default '',
  name text not null,
  pattern text not null default '',
  background text not null default '',
  rarity_model numeric not null default 0,
  rarity_pattern numeric not null default 0,
  rarity_background numeric not null default 0,
  total_supply integer not null default 0,
  floor_price integer not null check (floor_price >= 0)
);

create table if not exists public.gift_items (
  id uuid primary key default gen_random_uuid(),
  serial bigint not null unique,
  model_key text not null references public.gift_models(key),
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.gift_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  welcomed boolean not null default false,
  last_bonus_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.gift_listings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.gift_items(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  price integer not null check (price > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.gift_regular_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  gift_key text not null references public.gift_models(key),
  qty integer not null default 0 check (qty >= 0),
  primary key (user_id, gift_key)
);

create table if not exists public.gift_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  amount integer not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.gift_models enable row level security;
alter table public.gift_items enable row level security;
alter table public.gift_wallets enable row level security;
alter table public.gift_listings enable row level security;
alter table public.gift_regular_inventory enable row level security;
alter table public.gift_transactions enable row level security;

drop policy if exists gift_models_read on public.gift_models;
create policy gift_models_read on public.gift_models for select to authenticated using (true);
drop policy if exists gift_items_read on public.gift_items;
create policy gift_items_read on public.gift_items for select to authenticated using (true);
drop policy if exists gift_listings_read on public.gift_listings;
create policy gift_listings_read on public.gift_listings for select to authenticated using (true);
drop policy if exists gift_wallets_own on public.gift_wallets;
create policy gift_wallets_own on public.gift_wallets for select to authenticated using (user_id = auth.uid());
drop policy if exists gift_inventory_own on public.gift_regular_inventory;
create policy gift_inventory_own on public.gift_regular_inventory for select to authenticated using (user_id = auth.uid());
drop policy if exists gift_txns_own on public.gift_transactions;
create policy gift_txns_own on public.gift_transactions for select to authenticated using (user_id = auth.uid());

-- ---------- catalog seed (mirrors src/lib/giftData.ts; keep in sync) ----------
insert into public.gift_models (key, kind, collection, name, pattern, background, rarity_model, rarity_pattern, rarity_background, total_supply, floor_price) values
  ('crystal-wolf','collectible','Arcane Pets','Crystal Wolf','Tribal Paint','Moon Teal',2,0.5,1.5,12000,1450),
  ('hex-cauldron','collectible','Arcane Pets','Hex Cauldron','Bubble Eye','Violet Mist',3,1,2,15000,890),
  ('moon-owl','collectible','Arcane Pets','Moon Owl','Crescent Down','Midnight',1.5,0.8,1.2,9000,1750),
  ('ginger-heart','collectible','Sweet Life','Ginger Heart','Royal Icing','Peach Candy',4,1.5,2.5,20000,640),
  ('instant-ramen','collectible','Sweet Life','Instant Ramen','Spicy Broth','Amber',2,0.5,1.5,25000,720),
  ('honey-bear','collectible','Sweet Life','Honey Bear','Honeycomb','Honey Gold',5,2,3,30000,480),
  ('eternal-candle','collectible','Glow Garden','Eternal Candle','Leaf Flame','Emerald Night',3,1,2,14000,980),
  ('glow-mushroom','collectible','Glow Garden','Glow Cap','Firefly Windows','Plum Dusk',2.5,1,1.8,11000,1230),
  ('star-frog','collectible','Glow Garden','Star Frog','Tiny Crown','Mint Starlight',1,0.4,1,8000,2100),
  ('ruby-rose','regular','Regular','Ruby Rose','','',0,0,0,0,25),
  ('heart-charm','regular','Regular','Heart Charm','','',0,0,0,0,30),
  ('lucky-star','regular','Regular','Lucky Star','','',0,0,0,0,45),
  ('nex-gem','regular','Regular','NEX Gem','','',0,0,0,0,80)
on conflict (key) do update set floor_price = excluded.floor_price, name = excluded.name;

insert into public.gift_items (serial, model_key)
select 12040 + (m.mi - 1) * 7919 + i * 104729, m.key
from (select key, row_number() over (order by key) as mi from public.gift_models where kind = 'collectible') m
cross join generate_series(0, 3) as i
on conflict (serial) do nothing;

-- ---------- helpers ----------
create or replace function public.gift_model_json(p_key text)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'key', key, 'kind', kind, 'collection', collection, 'name', name,
    'pattern', pattern, 'background', background,
    'rarity_model', rarity_model::float8, 'rarity_pattern', rarity_pattern::float8,
    'rarity_background', rarity_background::float8,
    'total_supply', total_supply, 'floor_price', floor_price,
    'issued', (select count(*) from public.gift_items gi where gi.model_key = gift_models.key)
  from public.gift_models where key = p_key
$$;

create or replace function public.gift_item_json(p_id uuid)
returns jsonb language sql stable as $$
  select jsonb_build_object('id', id, 'serial', serial, 'model_key', model_key, 'owner_id', owner_id)
  from public.gift_items where id = p_id
$$;

create or replace function public.gift_ensure_wallet()
returns public.gift_wallets
language plpgsql security definer set search_path = public as $$
declare w public.gift_wallets; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Session expired. Please sign in again.'; end if;
  insert into public.gift_wallets (user_id, balance) values (v_uid, 0)
    on conflict (user_id) do nothing;
  select * into w from public.gift_wallets where user_id = v_uid for update;
  if not w.welcomed then
    update public.gift_wallets set balance = balance + 1000, welcomed = true
      where user_id = v_uid returning * into w;
    insert into public.gift_transactions (user_id, kind, amount, note)
      values (v_uid, 'welcome', 1000, 'Welcome bonus');
  end if;
  return w;
end $$;

-- ---------- read models ----------
create or replace function public.gifts_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); w public.gift_wallets;
        v_items jsonb; v_regular jsonb; v_txns jsonb; v_next timestamptz;
begin
  if v_uid is null then raise exception 'Session expired. Please sign in again.'; end if;
  w := public.gift_ensure_wallet();
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_items from (
    select jsonb_build_object(
      'item', public.gift_item_json(i.id),
      'model', public.gift_model_json(i.model_key),
      'listing', case when l.id is null then null else jsonb_build_object(
        'id', l.id, 'item_id', l.item_id, 'seller_id', l.seller_id,
        'price', l.price, 'created_at', l.created_at) end) as x
    from public.gift_items i
    left join public.gift_listings l on l.item_id = i.id
    where i.owner_id = v_uid
  ) s;
  select coalesce(jsonb_agg(y), '[]'::jsonb) into v_regular from (
    select jsonb_build_object('model', public.gift_model_json(inv.gift_key), 'qty', inv.qty) as y
    from public.gift_regular_inventory inv
    where inv.user_id = v_uid and inv.qty > 0
  ) s;
  select coalesce(jsonb_agg(z), '[]'::jsonb) into v_txns from (
    select jsonb_build_object('id', id, 'kind', kind, 'amount', amount, 'note', note, 'created_at', created_at) as z
    from public.gift_transactions where user_id = v_uid order by created_at desc limit 30
  ) s;
  v_next := case when w.last_bonus_at is not null
                   and w.last_bonus_at + interval '24 hours' > now()
                 then w.last_bonus_at + interval '24 hours' else null end;
  return jsonb_build_object(
    'balance', w.balance, 'nextBonusAt', v_next, 'bonusAmount', 250,
    'myItems', v_items, 'myRegular', v_regular, 'transactions', v_txns);
end $$;

create or replace function public.gifts_market()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_entries jsonb;
begin
  if auth.uid() is null then raise exception 'Session expired. Please sign in again.'; end if;
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_entries from (
    select jsonb_build_object(
      'item', public.gift_item_json(i.id),
      'model', public.gift_model_json(i.model_key),
      'listing', case when l.id is null then null else jsonb_build_object(
        'id', l.id, 'item_id', l.item_id, 'seller_id', l.seller_id,
        'price', l.price, 'created_at', l.created_at) end,
      'seller', case when p.id is null then null else jsonb_build_object(
        'id', p.id, 'username', p.username, 'display_name', p.display_name,
        'avatar_url', p.avatar_url, 'bio', p.bio, 'is_online', p.is_online,
        'last_seen', p.last_seen, 'created_at', p.created_at) end,
      'price', coalesce(l.price, m.floor_price)) as e
    from public.gift_items i
    join public.gift_models m on m.key = i.model_key
    left join public.gift_listings l on l.item_id = i.id
    left join public.profiles p on p.id = l.seller_id
    where l.id is not null or i.owner_id is null
  ) s;
  return jsonb_build_object('entries', v_entries);
end $$;

-- ---------- atomic operations ----------
create or replace function public.buy_gift(p_item uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); it public.gift_items; m public.gift_models;
        l public.gift_listings; w public.gift_wallets; v_price integer;
begin
  if v_uid is null then raise exception 'Session expired. Please sign in again.'; end if;
  perform public.gift_ensure_wallet();
  select * into it from public.gift_items where id = p_item for update;
  if it.id is null then raise exception 'Gift not found.'; end if;
  if it.owner_id = v_uid then raise exception 'This gift is already yours.'; end if;
  select * into l from public.gift_listings where item_id = p_item;
  if l.id is null and it.owner_id is not null then raise exception 'This gift is not for sale.'; end if;
  select * into m from public.gift_models where key = it.model_key;
  v_price := coalesce(l.price, m.floor_price);
  select * into w from public.gift_wallets where user_id = v_uid for update;
  if w.balance < v_price then raise exception 'Not enough NEX.'; end if;
  update public.gift_wallets set balance = balance - v_price where user_id = v_uid;
  if l.id is not null then
    insert into public.gift_wallets (user_id, balance) values (l.seller_id, 0)
      on conflict (user_id) do nothing;
    update public.gift_wallets set balance = balance + v_price where user_id = l.seller_id;
    insert into public.gift_transactions (user_id, kind, amount, note)
      values (l.seller_id, 'sale', v_price, m.name || ' #' || it.serial);
    delete from public.gift_listings where id = l.id;
  end if;
  update public.gift_items set owner_id = v_uid where id = p_item;
  insert into public.gift_transactions (user_id, kind, amount, note)
    values (v_uid, 'purchase', -v_price, m.name || ' #' || it.serial);
  select balance into v_price from public.gift_wallets where user_id = v_uid;
  return jsonb_build_object('balance', v_price);
end $$;

create or replace function public.list_gift(p_item uuid, p_price integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); it public.gift_items; l public.gift_listings;
begin
  if v_uid is null then raise exception 'Session expired. Please sign in again.'; end if;
  if p_price is null or p_price <= 0 or p_price > 1000000000 then
    raise exception 'Price must be a positive whole number.';
  end if;
  select * into it from public.gift_items where id = p_item for update;
  if it.id is null then raise exception 'Gift not found.'; end if;
  if it.owner_id <> v_uid then raise exception 'You do not own this gift.'; end if;
  if exists (select 1 from public.gift_listings where item_id = p_item) then
    raise exception 'This gift is already listed.';
  end if;
  insert into public.gift_listings (item_id, seller_id, price)
    values (p_item, v_uid, p_price) returning * into l;
  return jsonb_build_object('listing', jsonb_build_object(
    'id', l.id, 'item_id', l.item_id, 'seller_id', l.seller_id,
    'price', l.price, 'created_at', l.created_at));
end $$;

create or replace function public.unlist_gift(p_listing uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); l public.gift_listings;
begin
  if v_uid is null then raise exception 'Session expired. Please sign in again.'; end if;
  select * into l from public.gift_listings where id = p_listing;
  if l.id is null then raise exception 'Listing not found.'; end if;
  if l.seller_id <> v_uid then raise exception 'Access denied.'; end if;
  delete from public.gift_listings where id = p_listing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.buy_regular(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m public.gift_models; w public.gift_wallets;
begin
  if v_uid is null then raise exception 'Session expired. Please sign in again.'; end if;
  perform public.gift_ensure_wallet();
  select * into m from public.gift_models where key = p_key and kind = 'regular';
  if m.key is null then raise exception 'Gift not found.'; end if;
  select * into w from public.gift_wallets where user_id = v_uid for update;
  if w.balance < m.floor_price then raise exception 'Not enough NEX.'; end if;
  update public.gift_wallets set balance = balance - m.floor_price where user_id = v_uid;
  insert into public.gift_regular_inventory (user_id, gift_key, qty) values (v_uid, p_key, 1)
    on conflict (user_id, gift_key) do update set qty = public.gift_regular_inventory.qty + 1;
  insert into public.gift_transactions (user_id, kind, amount, note)
    values (v_uid, 'regular_buy', -m.floor_price, m.name);
  return jsonb_build_object('balance', w.balance - m.floor_price);
end $$;

-- Decrement one owned regular gift; the client then posts the gift message
-- through the normal (RLS-checked) chat path.
create or replace function public.take_regular(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_qty integer;
begin
  if v_uid is null then raise exception 'Session expired. Please sign in again.'; end if;
  select qty into v_qty from public.gift_regular_inventory
    where user_id = v_uid and gift_key = p_key for update;
  if v_qty is null or v_qty < 1 then raise exception 'No gifts left to send.'; end if;
  update public.gift_regular_inventory set qty = qty - 1
    where user_id = v_uid and gift_key = p_key;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.claim_bonus()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); w public.gift_wallets;
begin
  if v_uid is null then raise exception 'Session expired. Please sign in again.'; end if;
  perform public.gift_ensure_wallet();
  select * into w from public.gift_wallets where user_id = v_uid for update;
  if w.last_bonus_at is not null and w.last_bonus_at + interval '24 hours' > now() then
    raise exception 'Daily bonus is not ready yet.';
  end if;
  update public.gift_wallets
    set balance = balance + 250, last_bonus_at = now()
    where user_id = v_uid returning * into w;
  insert into public.gift_transactions (user_id, kind, amount, note)
    values (v_uid, 'bonus', 250, 'Daily bonus');
  return jsonb_build_object('balance', w.balance);
end $$;

grant execute on function public.gifts_state() to authenticated;
grant execute on function public.gifts_market() to authenticated;
grant execute on function public.buy_gift(uuid) to authenticated;
grant execute on function public.list_gift(uuid, integer) to authenticated;
grant execute on function public.unlist_gift(uuid) to authenticated;
grant execute on function public.buy_regular(text) to authenticated;
grant execute on function public.take_regular(text) to authenticated;
grant execute on function public.claim_bonus() to authenticated;
