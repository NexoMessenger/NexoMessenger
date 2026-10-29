-- Profile gifts showcase + archive removal (run AFTER 001–009; re-runnable).
-- The profile "Archive" tab was removed: un-hide anything archived before.
update public.profile_posts set archived = false where archived;

-- Public showcase of a user's gifts: collectible NFTs + regular gift stock.
-- SECURITY DEFINER so visitors can see regular inventory (owner-only table),
-- exposing catalog facts only (model + qty), never wallet data.
create or replace function public.profile_gifts(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_items jsonb; v_regular jsonb;
begin
  if auth.uid() is null then raise exception 'Session expired. Please sign in again.'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'User not found.';
  end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_items from (
    select jsonb_build_object(
      'item', public.gift_item_json(i.id),
      'model', public.gift_model_json(i.model_key),
      'listing', null) as x
    from public.gift_items i
    where i.owner_id = p_user
  ) s;
  select coalesce(jsonb_agg(y), '[]'::jsonb) into v_regular from (
    select jsonb_build_object('model', public.gift_model_json(inv.gift_key), 'qty', inv.qty) as y
    from public.gift_regular_inventory inv
    where inv.user_id = p_user and inv.qty > 0
  ) s;
  return jsonb_build_object('items', v_items, 'regular', v_regular);
end $$;

grant execute on function public.profile_gifts(uuid) to authenticated;
