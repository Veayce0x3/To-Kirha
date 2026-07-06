-- HDV joueur ↔ joueur : économie serveur (inventaire + Kirha dans saves.save_data)
-- Frais plateforme : 5 % prélevés sur le vendeur.

create or replace function public._save_adjust_kirha(p_save jsonb, p_delta bigint)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_kirha bigint;
begin
  v_kirha := coalesce((p_save->>'kirha')::bigint, 0) + p_delta;
  if v_kirha < 0 then
    raise exception 'Kirha insuffisants';
  end if;
  return jsonb_set(coalesce(p_save, '{}'::jsonb), '{kirha}', to_jsonb(v_kirha));
end;
$$;

create or replace function public._save_adjust_inventory(p_save jsonb, p_resource_id text, p_delta int)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_qty int;
  v_save jsonb := coalesce(p_save, '{}'::jsonb);
begin
  if p_resource_id is null or length(trim(p_resource_id)) = 0 then
    raise exception 'Ressource invalide';
  end if;
  v_qty := coalesce((v_save->'inventory'->>p_resource_id)::int, 0) + p_delta;
  if v_qty < 0 then
    raise exception 'Stock insuffisant';
  end if;
  if v_qty = 0 then
    return v_save #- array['inventory', p_resource_id];
  end if;
  if v_save ? 'inventory' then
    return jsonb_set(v_save, array['inventory', p_resource_id], to_jsonb(v_qty));
  end if;
  return jsonb_set(v_save, '{inventory}', jsonb_build_object(p_resource_id, v_qty));
end;
$$;

create or replace function public._save_touch_online(p_save jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_set(coalesce($1, '{}'::jsonb), '{lastOnline}', to_jsonb((extract(epoch from now()) * 1000)::bigint));
$$;

create or replace function public._market_lock_save(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_save jsonb;
begin
  select save_data into v_save from saves where user_id = p_user_id for update;
  if not found then
    insert into saves (user_id, save_data) values (p_user_id, '{}'::jsonb)
    on conflict (user_id) do nothing;
    select save_data into v_save from saves where user_id = p_user_id for update;
  end if;
  return coalesce(v_save, '{}'::jsonb);
end;
$$;

create or replace function public._market_write_save(p_user_id uuid, p_save jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update saves
  set save_data = public._save_touch_online(p_save),
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

-- Publier une vente (retire le stock du save vendeur)
create or replace function public.market_create_sell_listing(
  p_resource_id text,
  p_qty int,
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
  v_name text;
  v_listing_id uuid;
  v_expires timestamptz := now() + interval '72 hours';
begin
  if v_seller is null then raise exception 'Non authentifié'; end if;
  if public.user_is_banned(v_seller) then raise exception 'Compte suspendu'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantité invalide'; end if;
  if p_unit_price is null or p_unit_price <= 0 then raise exception 'Prix invalide'; end if;

  v_save := public._market_lock_save(v_seller);
  v_save := public._save_adjust_inventory(v_save, p_resource_id, -p_qty);

  select coalesce(nullif(trim(p_display_name), ''), display_name) into v_name
  from profiles where user_id = v_seller;
  v_name := coalesce(v_name, 'Voyageur');

  insert into market_sell_listings (
    seller_id, seller_name, resource_id, qty_total, qty_remaining, unit_price, expires_at
  ) values (
    v_seller, v_name, p_resource_id, p_qty, p_qty, p_unit_price, v_expires
  ) returning id into v_listing_id;

  perform public._market_write_save(v_seller, v_save);

  return jsonb_build_object('listing_id', v_listing_id, 'save', v_save);
end;
$$;

-- Publier une offre d'achat (escrow Kirha)
create or replace function public.market_create_buy_offer(
  p_resource_id text,
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
    max_unit_price, kirha_escrowed, expires_at
  ) values (
    v_buyer, v_name, p_resource_id, p_qty, p_qty, p_max_unit_price, v_escrow, v_expires
  ) returning id into v_offer_id;

  perform public._market_write_save(v_buyer, v_save);

  return jsonb_build_object('offer_id', v_offer_id, 'save', v_save);
end;
$$;

-- Acheter sur une annonce (transfert Kirha + inventaire côté serveur)
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

-- Vendre contre une offre d'achat
create or replace function public.market_fill_buy_offer(p_offer_id uuid, p_qty int)
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
begin
  if v_seller is null then raise exception 'Non authentifié'; end if;
  if public.user_is_banned(v_seller) then raise exception 'Compte suspendu'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantité invalide'; end if;

  select * into v_offer from market_buy_offers where id = p_offer_id for update;
  if not found then raise exception 'Offre introuvable'; end if;
  if v_offer.buyer_id = v_seller then raise exception 'Tu ne peux pas vendre à ta propre offre'; end if;
  if v_offer.expires_at <= now() then raise exception 'Offre expirée'; end if;
  if v_offer.qty_remaining < p_qty then raise exception 'Quantité demandée insuffisante'; end if;

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

-- Annuler une vente (restitue le stock)
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
  if v_listing.qty_remaining > 0 then
    v_save := public._save_adjust_inventory(v_save, v_listing.resource_id, v_listing.qty_remaining);
  end if;

  delete from market_sell_listings where id = p_listing_id;

  perform public._market_write_save(v_seller, v_save);

  return jsonb_build_object('save', v_save);
end;
$$;

-- Annuler une offre d'achat (restitue l'escrow)
create or replace function public.market_cancel_buy_offer(p_offer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer market_buy_offers%rowtype;
  v_buyer uuid := auth.uid();
  v_save jsonb;
begin
  if v_buyer is null then raise exception 'Non authentifié'; end if;

  select * into v_offer from market_buy_offers where id = p_offer_id for update;
  if not found then raise exception 'Offre introuvable'; end if;
  if v_offer.buyer_id <> v_buyer then raise exception 'Pas ton offre'; end if;

  v_save := public._market_lock_save(v_buyer);
  if v_offer.kirha_escrowed > 0 then
    v_save := public._save_adjust_kirha(v_save, v_offer.kirha_escrowed);
  end if;

  delete from market_buy_offers where id = p_offer_id;

  perform public._market_write_save(v_buyer, v_save);

  return jsonb_build_object('save', v_save);
end;
$$;

grant execute on function public.market_create_sell_listing(text, int, int, text) to authenticated;
grant execute on function public.market_create_buy_offer(text, int, int, text) to authenticated;
grant execute on function public.market_cancel_sell_listing(uuid) to authenticated;
grant execute on function public.market_cancel_buy_offer(uuid) to authenticated;

revoke execute on function public.market_create_sell_listing(text, int, int, text) from anon;
revoke execute on function public.market_create_buy_offer(text, int, int, text) from anon;
revoke execute on function public.market_cancel_sell_listing(uuid) from anon;
revoke execute on function public.market_cancel_buy_offer(uuid) from anon;

-- Temps réel : mises à jour instantanées de l'HDV joueur
do $$ begin
  alter publication supabase_realtime add table market_sell_listings;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table market_buy_offers;
exception when others then null;
end $$;
