-- To-Kirha — schéma Supabase (à exécuter dans SQL Editor)
-- Auth : email + mot de passe (Supabase Auth)

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Voyageur',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists leaderboard_entries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  char_level int not null default 1,
  max_job_level int not null default 1,
  season int not null default 1,
  total_earned bigint not null default 0,
  seasons_completed int not null default 0,
  total_harvests bigint not null default 0,
  boss_kills_total int not null default 0,
  kirha_current bigint not null default 0,
  updated_at timestamptz default now()
);

create index if not exists leaderboard_char_level_idx on leaderboard_entries (char_level desc);
create index if not exists leaderboard_max_job_level_idx on leaderboard_entries (max_job_level desc);
create index if not exists leaderboard_total_earned_idx on leaderboard_entries (total_earned desc);
create index if not exists leaderboard_seasons_idx on leaderboard_entries (seasons_completed desc);

create table if not exists market_sell_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  seller_name text not null,
  resource_id text not null,
  qty_total int not null check (qty_total > 0),
  qty_remaining int not null check (qty_remaining >= 0),
  unit_price int not null check (unit_price > 0),
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

create table if not exists market_buy_offers (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  buyer_name text not null,
  resource_id text not null,
  qty_total int not null check (qty_total > 0),
  qty_remaining int not null check (qty_remaining >= 0),
  max_unit_price int not null check (max_unit_price > 0),
  kirha_escrowed bigint not null default 0,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

alter table profiles enable row level security;
alter table saves enable row level security;
alter table leaderboard_entries enable row level security;
alter table market_sell_listings enable row level security;
alter table market_buy_offers enable row level security;

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

-- RPC marché P2P : voir supabase/rpc_market.sql (déployé via migration Supabase)
-- Système admin complet : voir supabase/admin_system.sql (rôles, ban, modération, config live)
