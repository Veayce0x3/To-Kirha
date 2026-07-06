-- RPC marché P2P To-Kirha
-- Exécuté via migration Supabase MCP

-- RLS policies (idempotent via DO blocks where needed)
alter table profiles enable row level security;
alter table saves enable row level security;
alter table leaderboard_entries enable row level security;
alter table market_sell_listings enable row level security;
alter table market_buy_offers enable row level security;

drop policy if exists "profiles read all" on profiles;
drop policy if exists "profiles upsert own" on profiles;
drop policy if exists "profiles update own" on profiles;
drop policy if exists "saves own" on saves;
drop policy if exists "leaderboard read all" on leaderboard_entries;
drop policy if exists "leaderboard upsert own" on leaderboard_entries;
drop policy if exists "leaderboard update own" on leaderboard_entries;
drop policy if exists "market sells read all" on market_sell_listings;
drop policy if exists "market sells insert own" on market_sell_listings;
drop policy if exists "market sells delete own" on market_sell_listings;
drop policy if exists "market buys read all" on market_buy_offers;
drop policy if exists "market buys insert own" on market_buy_offers;
drop policy if exists "market buys delete own" on market_buy_offers;

create policy "profiles read all" on profiles for select using (true);
create policy "profiles upsert own" on profiles for insert with check (auth.uid() = user_id);
create policy "profiles update own" on profiles for update using (auth.uid() = user_id);

create policy "saves own select" on saves for select using (auth.uid() = user_id);
create policy "saves own insert" on saves for insert with check (auth.uid() = user_id);
create policy "saves own update" on saves for update using (auth.uid() = user_id);

create policy "leaderboard read all" on leaderboard_entries for select using (true);
create policy "leaderboard upsert own" on leaderboard_entries for insert with check (auth.uid() = user_id);
create policy "leaderboard update own" on leaderboard_entries for update using (auth.uid() = user_id);

create policy "market sells read all" on market_sell_listings for select using (true);
create policy "market sells insert own" on market_sell_listings for insert with check (auth.uid() = seller_id);
create policy "market sells delete own" on market_sell_listings for delete using (auth.uid() = seller_id);

create policy "market buys read all" on market_buy_offers for select using (true);
create policy "market buys insert own" on market_buy_offers for insert with check (auth.uid() = buyer_id);
create policy "market buys delete own" on market_buy_offers for delete using (auth.uid() = buyer_id);

-- Acheter sur une annonce de vente
create or replace function public.market_buy_listing(p_listing_id uuid, p_qty int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing market_sell_listings%rowtype;
  v_buyer uuid := auth.uid();
begin
  if v_buyer is null then raise exception 'Non authentifié'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantité invalide'; end if;

  select * into v_listing from market_sell_listings where id = p_listing_id for update;
  if not found then raise exception 'Annonce introuvable'; end if;
  if v_listing.seller_id = v_buyer then raise exception 'Tu ne peux pas acheter ta propre annonce'; end if;
  if v_listing.expires_at <= now() then raise exception 'Annonce expirée'; end if;
  if v_listing.qty_remaining < p_qty then raise exception 'Stock insuffisant'; end if;

  update market_sell_listings set qty_remaining = qty_remaining - p_qty where id = p_listing_id;

  return jsonb_build_object(
    'listing_id', p_listing_id,
    'resource_id', v_listing.resource_id,
    'unit_price', v_listing.unit_price,
    'qty', p_qty,
    'total', v_listing.unit_price * p_qty,
    'seller_id', v_listing.seller_id,
    'seller_name', v_listing.seller_name
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
  v_payout bigint;
begin
  if v_seller is null then raise exception 'Non authentifié'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantité invalide'; end if;

  select * into v_offer from market_buy_offers where id = p_offer_id for update;
  if not found then raise exception 'Offre introuvable'; end if;
  if v_offer.buyer_id = v_seller then raise exception 'Tu ne peux pas vendre à ta propre offre'; end if;
  if v_offer.expires_at <= now() then raise exception 'Offre expirée'; end if;
  if v_offer.qty_remaining < p_qty then raise exception 'Quantité demandée insuffisante'; end if;

  v_payout := v_offer.max_unit_price * p_qty;

  update market_buy_offers
  set qty_remaining = qty_remaining - p_qty,
      kirha_escrowed = greatest(0, kirha_escrowed - v_payout)
  where id = p_offer_id;

  return jsonb_build_object(
    'offer_id', p_offer_id,
    'resource_id', v_offer.resource_id,
    'max_unit_price', v_offer.max_unit_price,
    'qty', p_qty,
    'payout', v_payout,
    'buyer_id', v_offer.buyer_id,
    'buyer_name', v_offer.buyer_name
  );
end;
$$;

grant execute on function public.market_buy_listing(uuid, int) to authenticated;
grant execute on function public.market_fill_buy_offer(uuid, int) to authenticated;
revoke execute on function public.market_buy_listing(uuid, int) from anon;
revoke execute on function public.market_fill_buy_offer(uuid, int) from anon;
