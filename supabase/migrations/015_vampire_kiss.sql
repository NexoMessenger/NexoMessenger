-- Optional Supabase catalog entry. Artwork and animation are bundled assets.
-- Rarity and total supply are unspecified; 2800 NEX is an in-app store price.
insert into public.gift_models (key, kind, collection, name, pattern, background, rarity_model, rarity_pattern, rarity_background, total_supply, floor_price)
values ('nexo-vampire-kiss', 'collectible', 'NEXO Vampire Kiss', 'NEXO Vampire Kiss', '', '', 0, 0, 0, 0, 2800)
on conflict (key) do nothing;

-- Four initial store items; reruns do not replenish items that were bought.
insert into public.gift_items (serial, model_key)
select 91230 + i * 104729, 'nexo-vampire-kiss'
from generate_series(0, 3) as i
where not exists (select 1 from public.gift_items where model_key = 'nexo-vampire-kiss')
on conflict (serial) do nothing;
