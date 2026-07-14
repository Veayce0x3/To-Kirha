-- HDV joueur : vente d'équipement / armes de combat entre joueurs
-- Colonnes listing_kind + combat_instance / combat_item_id sur les annonces existantes.

alter table market_sell_listings
  add column if not exists listing_kind text not null default 'resource',
  add column if not exists combat_instance jsonb null;

alter table market_buy_offers
  add column if not exists listing_kind text not null default 'resource',
  add column if not exists combat_item_id text null;

create or replace function public._save_combat_ref_equipped(p_save jsonb, p_instance_id text)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1 from jsonb_each_text(coalesce($1->'combatEquipment', '{}'::jsonb)) kv
    where kv.value = $2
  ) or exists (
    select 1
    from jsonb_each(coalesce($1->'companions', '{}'::jsonb)) c(comp_id, comp_data)
    cross join lateral jsonb_each_text(coalesce(comp_data->'equipment', '{}'::jsonb)) eq(slot, ref)
    where eq.ref = $2
  );
$$;

create or replace function public._save_owned_has_combat_ref(p_save jsonb, p_instance_id text)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from jsonb_array_elements_text(coalesce($1->'ownedCombatItems', '[]'::jsonb)) ref
    where ref = $2
  );
$$;

create or replace function public._save_unequip_combat_ref(p_save jsonb, p_instance_id text)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_save jsonb := coalesce(p_save, '{}'::jsonb);
  v_eq jsonb := coalesce(v_save->'combatEquipment', '{}'::jsonb);
  v_key text;
  v_val text;
  v_comp_key text;
  v_comp jsonb;
  v_comp_eq jsonb;
  v_slot text;
  v_ref text;
begin
  for v_key, v_val in select * from jsonb_each_text(v_eq)
  loop
    if v_val = p_instance_id then
      v_eq := jsonb_set(v_eq, array[v_key], 'null'::jsonb);
    end if;
  end loop;
  v_save := jsonb_set(v_save, '{combatEquipment}', v_eq);

  if v_save ? 'companions' then
    for v_comp_key, v_comp in select * from jsonb_each(coalesce(v_save->'companions', '{}'::jsonb))
    loop
      v_comp_eq := coalesce(v_comp->'equipment', '{}'::jsonb);
      for v_slot, v_ref in select * from jsonb_each_text(v_comp_eq)
      loop
        if v_ref = p_instance_id then
          v_comp_eq := jsonb_set(v_comp_eq, array[v_slot], 'null'::jsonb);
        end if;
      end loop;
      v_comp := jsonb_set(v_comp, '{equipment}', v_comp_eq);
      v_save := jsonb_set(v_save, array['companions', v_comp_key], v_comp);
    end loop;
  end if;

  return v_save;
end;
$$;

create or replace function public._save_take_combat_instance(p_save jsonb, p_instance_id text)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_save jsonb := coalesce(p_save, '{}'::jsonb);
  v_instance jsonb;
begin
  if not public._save_owned_has_combat_ref(v_save, p_instance_id) then
    raise exception 'Équipement introuvable dans ton inventaire';
  end if;
  if public._save_combat_ref_equipped(v_save, p_instance_id) then
    raise exception 'Déséquipe cet objet avant de le vendre';
  end if;

  select elem into v_instance
  from jsonb_array_elements(coalesce(v_save->'combatItemInstances', '[]'::jsonb)) elem
  where elem->>'instanceId' = p_instance_id
  limit 1;

  if v_instance is null then
    raise exception 'Instance d''équipement introuvable';
  end if;

  v_save := public._save_unequip_combat_ref(v_save, p_instance_id);

  v_save := jsonb_set(
    v_save,
    '{ownedCombatItems}',
    coalesce((
      select jsonb_agg(to_jsonb(ref))
      from jsonb_array_elements_text(coalesce(v_save->'ownedCombatItems', '[]'::jsonb)) ref
      where ref <> p_instance_id
    ), '[]'::jsonb)
  );

  v_save := jsonb_set(
    v_save,
    '{combatItemInstances}',
    coalesce((
      select jsonb_agg(elem)
      from jsonb_array_elements(coalesce(v_save->'combatItemInstances', '[]'::jsonb)) elem
      where elem->>'instanceId' <> p_instance_id
    ), '[]'::jsonb)
  );

  return jsonb_build_object('save', v_save, 'instance', v_instance);
end;
$$;

create or replace function public._save_grant_combat_instance(p_save jsonb, p_instance jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_save jsonb := coalesce(p_save, '{}'::jsonb);
  v_id text := p_instance->>'instanceId';
begin
  if v_id is null or length(trim(v_id)) = 0 then
    raise exception 'Instance invalide';
  end if;
  if public._save_owned_has_combat_ref(v_save, v_id) then
    raise exception 'Tu possèdes déjà cet objet';
  end if;

  v_save := jsonb_set(
    v_save,
    '{ownedCombatItems}',
    coalesce(v_save->'ownedCombatItems', '[]'::jsonb) || to_jsonb(v_id)
  );
  v_save := jsonb_set(
    v_save,
    '{combatItemInstances}',
    coalesce(v_save->'combatItemInstances', '[]'::jsonb) || jsonb_build_array(p_instance)
  );
  return v_save;
end;
$$;

-- Publier une vente d'équipement combat (1 pièce unique)
create or replace function public.market_create_combat_sell_listing(
  p_instance_id text,
  p_unit_price int,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller uuid := auth.uid();
  v_save jsonb;
  v_taken jsonb;
  v_instance jsonb;
  v_item_id text;
  v_name text;
  v_listing_id uuid;
  v_expires timestamptz := now() + interval '72 hours';
begin
  if v_seller is null then raise exception 'Non authentifié'; end if;
  if public.user_is_banned(v_seller) then raise exception 'Compte suspendu'; end if;
  if p_instance_id is null or length(trim(p_instance_id)) = 0 then raise exception 'Équipement invalide'; end if;
  if p_unit_price is null or p_unit_price <= 0 then raise exception 'Prix invalide'; end if;

  v_save := public._market_lock_save(v_seller);
  v_taken := public._save_take_combat_instance(v_save, p_instance_id);
  v_save := v_taken->'save';
  v_instance := v_taken->'instance';
  v_item_id := v_instance->>'itemId';

  if v_item_id is null then raise exception 'Équipement invalide'; end if;

  select coalesce(nullif(trim(p_display_name), ''), display_name) into v_name
  from profiles where user_id = v_seller;
  v_name := coalesce(v_name, 'Voyageur');

  insert into market_sell_listings (
    seller_id, seller_name, resource_id, qty_total, qty_remaining, unit_price, expires_at,
    listing_kind, combat_instance
  ) values (
    v_seller, v_name, v_item_id, 1, 1, p_unit_price, v_expires,
    'combat', v_instance
  ) returning id into v_listing_id;

  perform public._market_write_save(v_seller, v_save);

  return jsonb_build_object('listing_id', v_listing_id, 'save', v_save);
end;
$$;

-- Publier une recherche d'équipement combat (par modèle itemId)
create or replace function public.market_create_combat_buy_offer(
  p_item_id text,
  p_qty int,
  p_max_unit_price int,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer uuid := auth.uid();
  v_save jsonb;
  v_name text;
  v_offer_id uuid;
  v_escrow bigint;
  v_expires timestamptz := now() + interval '72 hours';
begin
  if v_buyer is null then raise exception 'Non authentifié'; end if;
  if public.user_is_banned(v_buyer) then raise exception 'Compte suspendu'; end if;
  if p_item_id is null or length(trim(p_item_id)) = 0 then raise exception 'Équipement invalide'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantité invalide'; end if;
  if p_max_unit_price is null or p_max_unit_price <= 0 then raise exception 'Prix invalide'; end if;

  v_escrow := p_qty::bigint * p_max_unit_price;
  v_save := public._market_lock_save(v_buyer);
  v_save := public._save_adjust_kirha(v_save, -v_escrow);

  select coalesce(nullif(trim(p_display_name), ''), display_name) into v_name
  from profiles where user_id = v_buyer;
  v_name := coalesce(v_name, 'Voyageur');

  insert into market_buy_offers (
    buyer_id, buyer_name, resource_id, qty_total, qty_remaining,
    max_unit_price, kirha_escrowed, expires_at, listing_kind, combat_item_id
  ) values (
    v_buyer, v_name, p_item_id, p_qty, p_qty, p_max_unit_price, v_escrow, v_expires,
    'combat', p_item_id
  ) returning id into v_offer_id;

  perform public._market_write_save(v_buyer, v_save);

  return jsonb_build_object('offer_id', v_offer_id, 'save', v_save);
end;
$$;

-- Acheter une annonce (ressource ou équipement combat)
create or replace function public.market_buy_listing(p_listing_id uuid, p_qty int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing market_sell_listings%rowtype;
  v_buyer uuid := auth.uid();
  v_buyer_save jsonb;
  v_seller_save jsonb;
  v_total bigint;
  v_fee bigint;
  v_payout bigint;
begin
  if v_buyer is null then raise exception 'Non authentifié'; end if;
  if public.user_is_banned(v_buyer) then raise exception 'Compte suspendu'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantité invalide'; end if;

  select * into v_listing from market_sell_listings where id = p_listing_id for update;
  if not found then raise exception 'Annonce introuvable'; end if;
  if v_listing.seller_id = v_buyer then raise exception 'Tu ne peux pas acheter ta propre annonce'; end if;
  if v_listing.expires_at <= now() then raise exception 'Annonce expirée'; end if;
  if v_listing.qty_remaining < p_qty then raise exception 'Stock insuffisant'; end if;

  if coalesce(v_listing.listing_kind, 'resource') = 'combat' then
    if p_qty <> 1 then raise exception 'Un équipement à la fois'; end if;
    if v_listing.combat_instance is null then raise exception 'Annonce invalide'; end if;

    v_total := v_listing.unit_price::bigint;
    v_fee := floor(v_total * 0.05);
    v_payout := v_total - v_fee;

    v_buyer_save := public._market_lock_save(v_buyer);
    v_buyer_save := public._save_adjust_kirha(v_buyer_save, -v_total);
    v_buyer_save := public._save_grant_combat_instance(v_buyer_save, v_listing.combat_instance);

    v_seller_save := public._market_lock_save(v_listing.seller_id);
    v_seller_save := public._save_adjust_kirha(v_seller_save, v_payout);

    delete from market_sell_listings where id = p_listing_id;

    perform public._market_write_save(v_buyer, v_buyer_save);
    perform public._market_write_save(v_listing.seller_id, v_seller_save);

    return jsonb_build_object(
      'listing_id', p_listing_id,
      'listing_kind', 'combat',
      'resource_id', v_listing.resource_id,
      'unit_price', v_listing.unit_price,
      'qty', 1,
      'total', v_total,
      'fee', v_fee,
      'seller_payout', v_payout,
      'combat_instance', v_listing.combat_instance,
      'save', v_buyer_save
    );
  end if;

  v_total := v_listing.unit_price::bigint * p_qty;
  v_fee := floor(v_total * 0.05);
  v_payout := v_total - v_fee;

  v_buyer_save := public._market_lock_save(v_buyer);
  v_buyer_save := public._save_adjust_kirha(v_buyer_save, -v_total);
  v_buyer_save := public._save_adjust_inventory(v_buyer_save, v_listing.resource_id, p_qty);

  v_seller_save := public._market_lock_save(v_listing.seller_id);
  v_seller_save := public._save_adjust_kirha(v_seller_save, v_payout);

  update market_sell_listings set qty_remaining = qty_remaining - p_qty where id = p_listing_id;

  perform public._market_write_save(v_buyer, v_buyer_save);
  perform public._market_write_save(v_listing.seller_id, v_seller_save);

  return jsonb_build_object(
    'listing_id', p_listing_id,
    'listing_kind', 'resource',
    'resource_id', v_listing.resource_id,
    'unit_price', v_listing.unit_price,
    'qty', p_qty,
    'total', v_total,
    'fee', v_fee,
    'seller_payout', v_payout,
    'save', v_buyer_save
  );
end;
$$;

-- Vendre contre une offre (ressource ou équipement combat)
create or replace function public.market_fill_buy_offer(p_offer_id uuid, p_qty int, p_instance_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer market_buy_offers%rowtype;
  v_seller uuid := auth.uid();
  v_seller_save jsonb;
  v_buyer_save jsonb;
  v_payout bigint;
  v_fee bigint;
  v_net bigint;
  v_taken jsonb;
  v_instance jsonb;
begin
  if v_seller is null then raise exception 'Non authentifié'; end if;
  if public.user_is_banned(v_seller) then raise exception 'Compte suspendu'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantité invalide'; end if;

  select * into v_offer from market_buy_offers where id = p_offer_id for update;
  if not found then raise exception 'Offre introuvable'; end if;
  if v_offer.buyer_id = v_seller then raise exception 'Tu ne peux pas vendre à ta propre offre'; end if;
  if v_offer.expires_at <= now() then raise exception 'Offre expirée'; end if;
  if v_offer.qty_remaining < p_qty then raise exception 'Quantité demandée insuffisante'; end if;

  if coalesce(v_offer.listing_kind, 'resource') = 'combat' then
    if p_qty <> 1 then raise exception 'Un équipement à la fois'; end if;
    if p_instance_id is null or length(trim(p_instance_id)) = 0 then
      raise exception 'Sélectionne un équipement à vendre';
    end if;

    v_seller_save := public._market_lock_save(v_seller);
    v_taken := public._save_take_combat_instance(v_seller_save, p_instance_id);
    v_seller_save := v_taken->'save';
    v_instance := v_taken->'instance';

    if (v_instance->>'itemId') is distinct from coalesce(v_offer.combat_item_id, v_offer.resource_id) then
      raise exception 'Ce n''est pas le bon type d''équipement';
    end if;

    v_payout := v_offer.max_unit_price::bigint;
    v_fee := floor(v_payout * 0.05);
    v_net := v_payout - v_fee;

    v_seller_save := public._save_adjust_kirha(v_seller_save, v_net);

    v_buyer_save := public._market_lock_save(v_offer.buyer_id);
    v_buyer_save := public._save_grant_combat_instance(v_buyer_save, v_instance);

    update market_buy_offers
    set qty_remaining = qty_remaining - 1,
        kirha_escrowed = greatest(0, kirha_escrowed - v_payout)
    where id = p_offer_id;

    perform public._market_write_save(v_seller, v_seller_save);
    perform public._market_write_save(v_offer.buyer_id, v_buyer_save);

    return jsonb_build_object(
      'offer_id', p_offer_id,
      'listing_kind', 'combat',
      'resource_id', v_offer.resource_id,
      'max_unit_price', v_offer.max_unit_price,
      'qty', 1,
      'payout', v_payout,
      'fee', v_fee,
      'net', v_net,
      'combat_instance', v_instance,
      'save', v_seller_save
    );
  end if;

  v_payout := v_offer.max_unit_price::bigint * p_qty;
  v_fee := floor(v_payout * 0.05);
  v_net := v_payout - v_fee;

  v_seller_save := public._market_lock_save(v_seller);
  v_seller_save := public._save_adjust_inventory(v_seller_save, v_offer.resource_id, -p_qty);
  v_seller_save := public._save_adjust_kirha(v_seller_save, v_net);

  v_buyer_save := public._market_lock_save(v_offer.buyer_id);
  v_buyer_save := public._save_adjust_inventory(v_buyer_save, v_offer.resource_id, p_qty);

  update market_buy_offers
  set qty_remaining = qty_remaining - p_qty,
      kirha_escrowed = greatest(0, kirha_escrowed - v_payout)
  where id = p_offer_id;

  perform public._market_write_save(v_seller, v_seller_save);
  perform public._market_write_save(v_offer.buyer_id, v_buyer_save);

  return jsonb_build_object(
    'offer_id', p_offer_id,
    'listing_kind', 'resource',
    'resource_id', v_offer.resource_id,
    'max_unit_price', v_offer.max_unit_price,
    'qty', p_qty,
    'payout', v_payout,
    'fee', v_fee,
    'net', v_net,
    'save', v_seller_save
  );
end;
$$;

-- Annuler une vente (ressource ou équipement combat)
create or replace function public.market_cancel_sell_listing(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing market_sell_listings%rowtype;
  v_seller uuid := auth.uid();
  v_save jsonb;
begin
  if v_seller is null then raise exception 'Non authentifié'; end if;

  select * into v_listing from market_sell_listings where id = p_listing_id for update;
  if not found then raise exception 'Annonce introuvable'; end if;
  if v_listing.seller_id <> v_seller then raise exception 'Pas ton annonce'; end if;

  v_save := public._market_lock_save(v_seller);

  if coalesce(v_listing.listing_kind, 'resource') = 'combat' then
    if v_listing.combat_instance is not null then
      v_save := public._save_grant_combat_instance(v_save, v_listing.combat_instance);
    end if;
  elsif v_listing.qty_remaining > 0 then
    v_save := public._save_adjust_inventory(v_save, v_listing.resource_id, v_listing.qty_remaining);
  end if;

  delete from market_sell_listings where id = p_listing_id;

  perform public._market_write_save(v_seller, v_save);

  return jsonb_build_object('save', v_save);
end;
$$;

grant execute on function public.market_create_combat_sell_listing(text, int, text) to authenticated;
grant execute on function public.market_create_combat_buy_offer(text, int, int, text) to authenticated;
revoke execute on function public.market_create_combat_sell_listing(text, int, text) from anon;
revoke execute on function public.market_create_combat_buy_offer(text, int, int, text) from anon;
