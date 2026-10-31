-- Optional Supabase catalog entry. NEX is an in-app virtual currency.
insert into public.gift_models (key, kind, collection, name, pattern, background, rarity_model, rarity_pattern, rarity_background, total_supply, floor_price)
values ('nexo-sailor', 'collectible', 'NEXO Sailor', 'NEXO Sailor', '', '', 0, 0, 0, 0, 3200)
on conflict (key) do nothing;

-- Initial store stock; reruns do not replenish purchased items.
insert into public.gift_items (serial, model_key)
select 99149 + i * 104729, 'nexo-sailor'
from generate_series(0, 3) as i
where not exists (select 1 from public.gift_items where model_key = 'nexo-sailor')
on conflict (serial) do nothing;
