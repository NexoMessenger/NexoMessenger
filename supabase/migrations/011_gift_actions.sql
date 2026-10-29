-- Gift actions: received regular gifts, sell-back, collectible transfer.
-- Run AFTER 001–010. Re-runnable.

-- Sending a regular gift now credits the RECIPIENT's inventory too
-- (previously the gift silently vanished after the chat message).
create or replace function public.send_regular(p_key text, p_to uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_qty integer;
begin
  if v_uid is null then raise exception 'Session expired. Please sign in again.'; end if;
  if p_to = v_uid then raise exception 'You cannot message yourself.'; end if;
  if not exists (select 1 from public.profiles where id = p_to) then
    raise exception 'Profile not found.';
  end if;
  select qty into v_qty from public.gift_regular_inventory
    where user_id = v_uid and gift_key = p_key for update;
  if v_qty is null or v_qty < 1 then raise exception 'No gifts left to send.'; end if;
  update public.gift_regular_inventory set qty = qty - 1
    where user_id = v_uid and gift_key = p_key;
  insert into public.gift_regular_inventory (user_id, gift_key, qty)
    values (p_to, p_key, 1)
    on conflict (user_id, gift_key) do update set qty = public.gift_regular_inventory.qty + 1;
  return jsonb_build_object('ok', true);
end $$;

-- Sell one regular gift back to the store: price minus a flat 2 NEX fee.
create or replace function public.sell_regular(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); w public.gift_wallets;
        v_qty integer; v_price integer; v_credit integer;
begin
  if v_uid is null then raise exception 'Session expired. Please sign in again.'; end if;
  select floor_price into v_price from public.gift_models where key = p_key and kind = 'regular';
  if v_price is null then raise exception 'Gift not found.'; end if;
  select qty into v_qty from public.gift_regular_inventory
    where user_id = v_uid and gift_key = p_key for update;
  if v_qty is null or v_qty < 1 then raise exception 'No gifts left to sell.'; end if;
  v_credit := v_price - 2;
  if v_credit <= 0 then raise exception 'This gift cannot be sold.'; end if;
  update public.gift_regular_inventory set qty = qty - 1
    where user_id = v_uid and gift_key = p_key;
  perform public.gift_ensure_wallet();
  update public.gift_wallets set balance = balance + v_credit
    where user_id = v_uid returning * into w;
  insert into public.gift_transactions (user_id, kind, amount, note)
    values (v_uid, 'regular_sell', v_credit, (select name from public.gift_models where key = p_key));
  return jsonb_build_object('balance', w.balance, 'credit', v_credit, 'qty', v_qty - 1);
end $$;

-- Transfer a collectible to another user; sender pays a flat 25 NEX fee.
create or replace function public.transfer_gift(p_item uuid, p_to uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); w public.gift_wallets;
        it public.gift_items; v_name text; v_fee constant integer := 25;
begin
  if v_uid is null then raise exception 'Session expired. Please sign in again.'; end if;
  select * into it from public.gift_items where id = p_item for update;
  if it.id is null then raise exception 'Gift not found.'; end if;
  if it.owner_id is distinct from v_uid then raise exception 'You do not own this gift.'; end if;
  if p_to = v_uid then raise exception 'You cannot transfer to yourself.'; end if;
  if not exists (select 1 from public.profiles where id = p_to) then
    raise exception 'Profile not found.';
  end if;
  perform public.gift_ensure_wallet();
  select * into w from public.gift_wallets where user_id = v_uid for update;
  if w.balance < v_fee then raise exception 'Not enough NEX.'; end if;
  select name into v_name from public.gift_models where key = it.model_key;
  update public.gift_wallets set balance = balance - v_fee
    where user_id = v_uid returning * into w;
  delete from public.gift_listings where item_id = p_item;
  update public.gift_items set owner_id = p_to where id = p_item;
  insert into public.gift_transactions (user_id, kind, amount, note) values
    (v_uid, 'transfer', -v_fee, v_name || ' #' || it.serial),
    (p_to, 'transfer', 0, v_name || ' #' || it.serial);
  return jsonb_build_object('balance', w.balance, 'fee', v_fee);
end $$;

grant execute on function public.send_regular(text, uuid) to authenticated;
grant execute on function public.sell_regular(text) to authenticated;
grant execute on function public.transfer_gift(uuid, uuid) to authenticated;
