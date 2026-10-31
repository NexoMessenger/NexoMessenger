-- NEXO Kaleidoscope: store prices in virtual NEX; no rarity or total supply claims.
insert into public.gift_models (key, kind, collection, name, pattern, background, rarity_model, rarity_pattern, rarity_background, total_supply, floor_price)
values
  ('nexo-tnt-pop', 'collectible', 'NEXO Kaleidoscope', 'NEXO TNT Pop', '', '', 0, 0, 0, 0, 1500),
  ('nexo-mint-mug', 'collectible', 'NEXO Kaleidoscope', 'NEXO Mint Mug', '', '', 0, 0, 0, 0, 1500),
  ('nexo-midnight-noodles', 'collectible', 'NEXO Kaleidoscope', 'NEXO Midnight Noodles', '', '', 0, 0, 0, 0, 1500),
  ('nexo-freedom-socks', 'collectible', 'NEXO Kaleidoscope', 'NEXO Freedom Socks', '', '', 0, 0, 0, 0, 1500),
  ('nexo-golden-stitch', 'collectible', 'NEXO Kaleidoscope', 'NEXO Golden Stitch', '', '', 0, 0, 0, 0, 1500),
  ('nexo-velvet-ring', 'collectible', 'NEXO Kaleidoscope', 'NEXO Velvet Ring', '', '', 0, 0, 0, 0, 1500),
  ('nexo-heart-pass', 'collectible', 'NEXO Kaleidoscope', 'NEXO Heart Pass', '', '', 0, 0, 0, 0, 1500),
  ('nexo-shadow-orb', 'collectible', 'NEXO Kaleidoscope', 'NEXO Shadow Orb', '', '', 0, 0, 0, 0, 1500),
  ('nexo-dream-orb', 'collectible', 'NEXO Kaleidoscope', 'NEXO Dream Orb', '', '', 0, 0, 0, 0, 1500),
  ('nexo-golden-clover', 'collectible', 'NEXO Kaleidoscope', 'NEXO Golden Clover', '', '', 0, 0, 0, 0, 1500),
  ('nexo-flame-rocket', 'collectible', 'NEXO Kaleidoscope', 'NEXO Flame Rocket', '', '', 0, 0, 0, 0, 1500),
  ('nexo-emerald-clover', 'collectible', 'NEXO Kaleidoscope', 'NEXO Emerald Clover', '', '', 0, 0, 0, 0, 1500),
  ('nexo-ember-tree', 'collectible', 'NEXO Kaleidoscope', 'NEXO Ember Tree', '', '', 0, 0, 0, 0, 1500),
  ('nexo-jade-pup', 'collectible', 'NEXO Kaleidoscope', 'NEXO Jade Pup', '', '', 0, 0, 0, 0, 1500),
  ('nexo-lava-light', 'collectible', 'NEXO Kaleidoscope', 'NEXO Lava Light', '', '', 0, 0, 0, 0, 1500)
on conflict (key) do nothing;

-- Four initial in-app store copies per model; do not restock on reruns.
insert into public.gift_items (serial, model_key)
select 12040 + (12 + model.idx) * 7919 + copies.i * 104729, model.key
from (values
  ('nexo-tnt-pop', 0),
  ('nexo-mint-mug', 1),
  ('nexo-midnight-noodles', 2),
  ('nexo-freedom-socks', 3),
  ('nexo-golden-stitch', 4),
  ('nexo-velvet-ring', 5),
  ('nexo-heart-pass', 6),
  ('nexo-shadow-orb', 7),
  ('nexo-dream-orb', 8),
  ('nexo-golden-clover', 9),
  ('nexo-flame-rocket', 10),
  ('nexo-emerald-clover', 11),
  ('nexo-ember-tree', 12),
  ('nexo-jade-pup', 13),
  ('nexo-lava-light', 14)
) as model(key, idx)
cross join generate_series(0, 3) as copies(i)
where not exists (select 1 from public.gift_items where model_key = model.key)
on conflict (serial) do nothing;
