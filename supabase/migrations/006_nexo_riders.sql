-- NEXO Riders — owner-provided collectible gift (run AFTER 005; safe to re-run).
-- Artwork and reveal animation are bundled with the app
-- (src/assets/gifts/nexo-riders.png / nexo-riders.webm); only the catalog
-- entry and its store stock live in the database.

insert into public.gift_models (key, kind, collection, name, pattern, background, rarity_model, rarity_pattern, rarity_background, total_supply, floor_price) values
  ('nexo-riders','collectible','NEXO Riders','NEXO Riders','Emerald Chrome','Obsidian',1,0.5,1.5,1000,5000)
on conflict (key) do update set name = excluded.name, floor_price = excluded.floor_price;

insert into public.gift_items (serial, model_key)
select 83311 + i * 104729, 'nexo-riders'
from generate_series(0, 3) as i
on conflict (serial) do nothing;
