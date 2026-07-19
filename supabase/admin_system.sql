-- To-Kirha — Système admin complet (modération, ban, config, signalements)
-- Appliquer via migration Supabase ou SQL Editor

-- ── Extension profiles ──
alter table profiles add column if not exists role text not null default 'player'
  check (role in ('player', 'moderator', 'admin', 'superadmin'));
alter table profiles add column if not exists is_banned boolean not null default false;
alter table profiles add column if not exists banned_at timestamptz;
alter table profiles add column if not exists banned_reason text;
alter table profiles add column if not exists banned_by uuid references auth.users(id);
alter table profiles add column if not exists cheat_flagged boolean not null default false;
alter table profiles add column if not exists cheat_notes text;

-- ── Tables admin ──
create table if not exists moderation_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists player_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'pending'
    check (status in ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by uuid references auth.users(id),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  kind text not null default 'info'
    check (kind in ('info', 'warn', 'maintenance', 'event')),
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists game_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- Config par défaut
insert into game_config (key, value) values
  ('maintenance_mode', 'false'::jsonb),
  ('leaderboard_enabled', 'true'::jsonb),
  ('market_p2p_enabled', 'true'::jsonb),
  ('test_hdv_enabled', 'true'::jsonb),
  ('reporting_enabled', 'true'::jsonb)
on conflict (key) do nothing;

create index if not exists moderation_logs_created_idx on moderation_logs (created_at desc);
create index if not exists player_reports_status_idx on player_reports (status, created_at desc);
create index if not exists announcements_active_idx on announcements (active, starts_at desc);

-- ── Helpers rôle / ban ──
create or replace function public.get_my_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where user_id = auth.uid()), 'player');
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('moderator', 'admin', 'superadmin') from profiles where user_id = auth.uid()), false);
$$;

create or replace function public.is_admin_or_above()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'superadmin') from profiles where user_id = auth.uid()), false);
$$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'superadmin' from profiles where user_id = auth.uid()), false);
$$;

create or replace function public.user_is_banned(p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_banned from profiles where user_id = p_uid), false);
$$;

-- Empêche l'escalade de privilèges via update direct
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' and auth.uid() is not null and auth.uid() = OLD.user_id then
    if NEW.role is distinct from OLD.role then NEW.role := OLD.role; end if;
    if NEW.is_banned is distinct from OLD.is_banned then NEW.is_banned := OLD.is_banned; end if;
    if NEW.banned_at is distinct from OLD.banned_at then NEW.banned_at := OLD.banned_at; end if;
    if NEW.banned_reason is distinct from OLD.banned_reason then NEW.banned_reason := OLD.banned_reason; end if;
    if NEW.banned_by is distinct from OLD.banned_by then NEW.banned_by := OLD.banned_by; end if;
    if NEW.cheat_flagged is distinct from OLD.cheat_flagged then NEW.cheat_flagged := OLD.cheat_flagged; end if;
    if NEW.cheat_notes is distinct from OLD.cheat_notes then NEW.cheat_notes := OLD.cheat_notes; end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_protect_profile_privileges on profiles;
create trigger trg_protect_profile_privileges
  before update on profiles
  for each row execute function protect_profile_privileges();

-- Log interne modération
create or replace function public._admin_log(
  p_action text, p_target uuid default null, p_reason text default null, p_details jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into moderation_logs (actor_id, target_user_id, action, reason, details)
  values (auth.uid(), p_target, p_action, p_reason, p_details);
end;
$$;

-- ── RLS admin tables ──
alter table moderation_logs enable row level security;
alter table player_reports enable row level security;
alter table announcements enable row level security;
alter table game_config enable row level security;

drop policy if exists "moderation_logs staff read" on moderation_logs;
create policy "moderation_logs staff read" on moderation_logs for select using (public.is_staff());

drop policy if exists "player_reports insert own" on player_reports;
drop policy if exists "player_reports staff read" on player_reports;
drop policy if exists "player_reports staff update" on player_reports;
create policy "player_reports insert own" on player_reports for insert
  with check (auth.uid() = reporter_id and reporter_id != reported_user_id);
create policy "player_reports staff read" on player_reports for select using (public.is_staff());
create policy "player_reports staff update" on player_reports for update using (public.is_staff());

drop policy if exists "announcements read active" on announcements;
create policy "announcements read active" on announcements for select using (
  active and starts_at <= now() and (ends_at is null or ends_at > now())
);
drop policy if exists "announcements staff all" on announcements;
create policy "announcements staff all" on announcements for select using (public.is_staff());

drop policy if exists "game_config read all auth" on game_config;
create policy "game_config read all auth" on game_config for select to authenticated using (true);

-- Bannis : bloquer écritures online
drop policy if exists "saves own insert" on saves;
drop policy if exists "saves own update" on saves;
create policy "saves own insert" on saves for insert
  with check (auth.uid() = user_id and not public.user_is_banned());
create policy "saves own update" on saves for update
  using (auth.uid() = user_id and not public.user_is_banned());

drop policy if exists "leaderboard upsert own" on leaderboard_entries;
drop policy if exists "leaderboard update own" on leaderboard_entries;
create policy "leaderboard upsert own" on leaderboard_entries for insert
  with check (auth.uid() = user_id and not public.user_is_banned());
create policy "leaderboard update own" on leaderboard_entries for update
  using (auth.uid() = user_id and not public.user_is_banned());

drop policy if exists "market sells insert own" on market_sell_listings;
drop policy if exists "market buys insert own" on market_buy_offers;
create policy "market sells insert own" on market_sell_listings for insert
  with check (auth.uid() = seller_id and not public.user_is_banned());
create policy "market buys insert own" on market_buy_offers for insert
  with check (auth.uid() = buyer_id and not public.user_is_banned());

-- Validation stats classement (anti-triche basique serveur)
create or replace function public.validate_leaderboard_stats()
returns trigger language plpgsql as $$
begin
  if NEW.char_level < 1 or NEW.char_level > 500 then
    raise exception 'Niveau personnage invalide';
  end if;
  if NEW.total_earned < 0 or NEW.total_earned > 999999999999 then
    raise exception 'Fortune invalide';
  end if;
  if NEW.kirha_current < 0 or NEW.kirha_current > 999999999999 then
    raise exception 'Kirha invalide';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_validate_leaderboard on leaderboard_entries;
create trigger trg_validate_leaderboard
  before insert or update on leaderboard_entries
  for each row execute function validate_leaderboard_stats();

-- ── RPC publiques ──
create or replace function public.get_active_announcements()
returns setof announcements language sql stable security definer set search_path = public as $$
  select * from announcements
  where active and starts_at <= now() and (ends_at is null or ends_at > now())
  order by created_at desc limit 10;
$$;

create or replace function public.get_game_config_public()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from game_config;
$$;

create or replace function public.submit_player_report(
  p_reported_user_id uuid, p_reason text, p_details text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  if auth.uid() = p_reported_user_id then raise exception 'Tu ne peux pas te signaler toi-même'; end if;
  if not coalesce((select (value = 'true'::jsonb) from game_config where key = 'reporting_enabled'), true) then
    raise exception 'Signalements désactivés';
  end if;
  insert into player_reports (reporter_id, reported_user_id, reason, details)
  values (auth.uid(), p_reported_user_id, left(p_reason, 500), left(p_details, 2000))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.get_my_profile()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v profiles%rowtype;
begin
  if auth.uid() is null then return null; end if;
  select * into v from profiles where user_id = auth.uid();
  if not found then return null; end if;
  return jsonb_build_object(
    'user_id', v.user_id,
    'display_name', v.display_name,
    'is_banned', v.is_banned,
    'banned_reason', v.banned_reason,
    'cheat_flagged', v.cheat_flagged,
    'admin_access', v.role in ('admin', 'superadmin'),
    'role', coalesce(nullif(v.role, ''), 'player')
  );
end;
$$;

-- ── RPC admin ──
create or replace function public.admin_get_dashboard()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  return jsonb_build_object(
    'players_total', (select count(*) from profiles),
    'players_banned', (select count(*) from profiles where is_banned),
    'players_flagged', (select count(*) from profiles where cheat_flagged),
    'players_new_24h', (select count(*) from profiles where created_at > now() - interval '24 hours'),
    'reports_pending', (select count(*) from player_reports where status = 'pending'),
    'market_sells_active', (select count(*) from market_sell_listings where qty_remaining > 0 and expires_at > now()),
    'market_buys_active', (select count(*) from market_buy_offers where qty_remaining > 0 and expires_at > now()),
    'leaderboard_entries', (select count(*) from leaderboard_entries),
    'saves_total', (select count(*) from saves),
    'announcements_active', (select count(*) from announcements where active and starts_at <= now() and (ends_at is null or ends_at > now())),
    'staff_count', (select count(*) from profiles where role in ('moderator', 'admin', 'superadmin')),
    'config', public.get_game_config_public(),
    'recent_players', coalesce((
      select jsonb_agg(row_to_json(t)) from (
        select user_id, display_name, role, created_at from profiles order by created_at desc limit 6
      ) t
    ), '[]'::jsonb),
    'recent_logs', coalesce((
      select jsonb_agg(row_to_json(t)) from (
        select l.action, l.reason, l.created_at, pa.display_name as actor_name, pt.display_name as target_name
        from moderation_logs l
        left join profiles pa on pa.user_id = l.actor_id
        left join profiles pt on pt.user_id = l.target_user_id
        order by l.created_at desc limit 8
      ) t
    ), '[]'::jsonb),
    'pending_reports', coalesce((
      select jsonb_agg(row_to_json(t)) from (
        select r.id, r.reason, r.created_at, pd.display_name as reported_name, r.reported_user_id
        from player_reports r
        left join profiles pd on pd.user_id = r.reported_user_id
        where r.status = 'pending'
        order by r.created_at desc limit 5
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_search_players(p_query text, p_limit int default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q text := trim(coalesce(p_query, ''));
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  if length(v_q) < 2 then raise exception 'Requête trop courte (min 2 car.)'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select p.user_id, p.display_name, p.role, p.is_banned, p.cheat_flagged, p.created_at,
        le.char_level, le.season, le.total_earned, le.kirha_current
      from profiles p
      left join leaderboard_entries le on le.user_id = p.user_id
      where p.display_name ilike '%' || v_q || '%'
         or p.user_id::text ilike v_q || '%'
      order by p.display_name
      limit least(greatest(p_limit, 1), 100)
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_get_player_detail(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles%rowtype;
  v_save jsonb;
  v_sells int;
  v_buys int;
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  select * into v_profile from profiles where user_id = p_user_id;
  if not found then raise exception 'Joueur introuvable'; end if;
  select save_data into v_save from saves where user_id = p_user_id;
  select count(*) into v_sells from market_sell_listings where seller_id = p_user_id and qty_remaining > 0;
  select count(*) into v_buys from market_buy_offers where buyer_id = p_user_id and qty_remaining > 0;
  return jsonb_build_object(
    'profile', jsonb_build_object(
      'user_id', v_profile.user_id, 'display_name', v_profile.display_name,
      'role', v_profile.role, 'is_banned', v_profile.is_banned,
      'banned_at', v_profile.banned_at, 'banned_reason', v_profile.banned_reason,
      'cheat_flagged', v_profile.cheat_flagged, 'cheat_notes', v_profile.cheat_notes,
      'created_at', v_profile.created_at
    ),
    'leaderboard', (select row_to_json(le) from leaderboard_entries le where le.user_id = p_user_id),
    'save_summary', case when v_save is null then null else jsonb_build_object(
      'kirha', coalesce((v_save->>'kirha')::bigint, 0),
      'season', coalesce((v_save->>'season')::int, 1),
      'char_level', coalesce((v_save->'character'->>'level')::int, 1),
      'nickname', v_save->'character'->>'nickname',
      'last_online', v_save->>'lastOnline',
      'career_confirmed', coalesce((v_save->'careerChoice'->>'confirmed')::boolean, false),
      'career_harvest', v_save->'careerChoice'->>'harvest',
      'career_farm', v_save->'careerChoice'->>'farm'
    ) end,
    'market_sells_active', v_sells,
    'market_buys_active', v_buys,
    'reports_against', (select count(*) from player_reports where reported_user_id = p_user_id),
    'reports_by', (select count(*) from player_reports where reporter_id = p_user_id)
  );
end;
$$;

create or replace function public.admin_ban_user(p_target uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  if p_target = auth.uid() then raise exception 'Tu ne peux pas te bannir toi-même'; end if;
  if not public.is_admin_or_above() and exists (
    select 1 from profiles where user_id = p_target and role in ('admin', 'superadmin')
  ) then raise exception 'Seul un admin peut bannir ce compte'; end if;
  update profiles set is_banned = true, banned_at = now(), banned_reason = left(p_reason, 500), banned_by = auth.uid()
  where user_id = p_target;
  delete from leaderboard_entries where user_id = p_target;
  delete from market_sell_listings where seller_id = p_target;
  delete from market_buy_offers where buyer_id = p_target;
  perform public._admin_log('ban', p_target, p_reason);
end;
$$;

create or replace function public.admin_unban_user(p_target uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  update profiles set is_banned = false, banned_at = null, banned_reason = null, banned_by = null
  where user_id = p_target;
  perform public._admin_log('unban', p_target, p_reason);
end;
$$;

create or replace function public.admin_set_role(p_target uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'Superadmin requis'; end if;
  if p_role not in ('player', 'moderator', 'admin', 'superadmin') then raise exception 'Rôle invalide'; end if;
  if p_target = auth.uid() and p_role != 'superadmin' then raise exception 'Tu ne peux pas te rétrograder toi-même'; end if;
  update profiles set role = p_role where user_id = p_target;
  perform public._admin_log('set_role', p_target, p_role, jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.admin_flag_cheat(p_target uuid, p_flagged boolean, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  update profiles set cheat_flagged = p_flagged, cheat_notes = left(p_notes, 1000) where user_id = p_target;
  perform public._admin_log('flag_cheat', p_target, p_notes, jsonb_build_object('flagged', p_flagged));
end;
$$;

create or replace function public.admin_delete_leaderboard(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  delete from leaderboard_entries where user_id = p_user_id;
  perform public._admin_log('delete_leaderboard', p_user_id);
end;
$$;

create or replace function public.admin_wipe_market(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  delete from market_sell_listings where seller_id = p_user_id;
  delete from market_buy_offers where buyer_id = p_user_id;
  perform public._admin_log('wipe_market', p_user_id);
end;
$$;

create or replace function public.admin_reset_cloud_save(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_or_above() then raise exception 'Admin requis'; end if;
  delete from saves where user_id = p_user_id;
  perform public._admin_log('reset_cloud_save', p_user_id);
end;
$$;

create or replace function public.admin_get_logs(p_limit int default 50, p_action text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select l.*, pa.display_name as actor_name, pt.display_name as target_name
      from moderation_logs l
      left join profiles pa on pa.user_id = l.actor_id
      left join profiles pt on pt.user_id = l.target_user_id
      where p_action is null or p_action = '' or l.action = p_action
      order by l.created_at desc
      limit least(greatest(p_limit, 1), 200)
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_get_reports(p_status text default 'pending', p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select r.*,
        pr.display_name as reporter_name,
        pd.display_name as reported_name
      from player_reports r
      left join profiles pr on pr.user_id = r.reporter_id
      left join profiles pd on pd.user_id = r.reported_user_id
      where p_status = 'all' or r.status = p_status
      order by r.created_at desc
      limit least(greatest(p_limit, 1), 200)
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_review_report(
  p_report_id uuid, p_status text, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  if p_status not in ('reviewed', 'dismissed', 'actioned') then raise exception 'Statut invalide'; end if;
  update player_reports set
    status = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = left(p_note, 1000)
  where id = p_report_id;
  perform public._admin_log('review_report', null, p_note, jsonb_build_object('report_id', p_report_id, 'status', p_status));
end;
$$;

create or replace function public.admin_list_announcements(p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_or_above() then raise exception 'Admin requis'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(a))
    from (
      select * from announcements order by created_at desc limit least(p_limit, 100)
    ) a
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_create_announcement(
  p_title text, p_body text, p_kind text default 'info', p_hours int default 72
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin_or_above() then raise exception 'Admin requis'; end if;
  insert into announcements (title, body, kind, active, ends_at, created_by)
  values (left(p_title, 200), left(p_body, 2000), coalesce(p_kind, 'info'), true,
    case when p_hours > 0 then now() + (p_hours || ' hours')::interval else null end,
    auth.uid())
  returning id into v_id;
  perform public._admin_log('create_announcement', null, p_title, jsonb_build_object('id', v_id));
  return v_id;
end;
$$;

create or replace function public.admin_toggle_announcement(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_or_above() then raise exception 'Admin requis'; end if;
  update announcements set active = p_active where id = p_id;
  perform public._admin_log('toggle_announcement', null, null, jsonb_build_object('id', p_id, 'active', p_active));
end;
$$;

create or replace function public.admin_get_config()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_or_above() then raise exception 'Admin requis'; end if;
  return public.get_game_config_public();
end;
$$;

create or replace function public.admin_set_config(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_or_above() then raise exception 'Admin requis'; end if;
  insert into game_config (key, value, updated_at, updated_by)
  values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  perform public._admin_log('set_config', null, p_key, p_value);
end;
$$;

create or replace function public.admin_list_market(p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  return jsonb_build_object(
    'sells', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select m.*, p.display_name as seller_display
        from market_sell_listings m
        left join profiles p on p.user_id = m.seller_id
        where m.qty_remaining > 0 and m.expires_at > now()
        order by m.created_at desc limit least(p_limit, 100)
      ) t
    ), '[]'::jsonb),
    'buys', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select m.*, p.display_name as buyer_display
        from market_buy_offers m
        left join profiles p on p.user_id = m.buyer_id
        where m.qty_remaining > 0 and m.expires_at > now()
        order by m.created_at desc limit least(p_limit, 100)
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_delete_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  delete from market_sell_listings where id = p_listing_id;
  perform public._admin_log('delete_listing', null, null, jsonb_build_object('listing_id', p_listing_id));
end;
$$;

create or replace function public.admin_delete_buy_offer(p_offer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  delete from market_buy_offers where id = p_offer_id;
  perform public._admin_log('delete_buy_offer', null, null, jsonb_build_object('offer_id', p_offer_id));
end;
$$;

create or replace function public.admin_list_leaderboard(p_sort text default 'char_level', p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select le.*, p.display_name, p.role, p.is_banned, p.cheat_flagged
      from leaderboard_entries le
      join profiles p on p.user_id = le.user_id
      order by
        case when p_sort = 'total_earned' then le.total_earned end desc nulls last,
        case when p_sort = 'char_level' then le.char_level end desc nulls last,
        case when p_sort = 'seasons_completed' then le.seasons_completed end desc nulls last,
        le.updated_at desc
      limit least(greatest(p_limit, 1), 200)
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_list_players(p_filter text default 'recent', p_limit int default 40)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select p.user_id, p.display_name, p.role, p.is_banned, p.cheat_flagged, p.created_at,
        le.char_level, le.season, le.total_earned, le.kirha_current
      from profiles p
      left join leaderboard_entries le on le.user_id = p.user_id
      where case p_filter
        when 'banned' then p.is_banned
        when 'flagged' then p.cheat_flagged
        when 'staff' then p.role in ('moderator', 'admin', 'superadmin')
        else true
      end
      order by case when p_filter = 'recent' then p.created_at end desc nulls last, p.display_name
      limit least(greatest(p_limit, 1), 100)
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_list_saves(p_limit int default 40)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_or_above() then raise exception 'Admin requis'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select s.user_id, s.updated_at, p.display_name, p.is_banned, p.cheat_flagged,
        coalesce((s.save_data->>'kirha')::bigint, 0) as kirha,
        coalesce((s.save_data->'character'->>'level')::int, 1) as char_level,
        s.save_data->'character'->>'nickname' as nickname,
        coalesce((s.save_data->>'season')::int, 1) as season
      from saves s
      join profiles p on p.user_id = s.user_id
      order by s.updated_at desc
      limit least(greatest(p_limit, 1), 100)
    ) t
  ), '[]'::jsonb);
end;
$$;

-- Grants RPC
grant execute on function public.get_active_announcements() to authenticated, anon;
grant execute on function public.get_game_config_public() to authenticated, anon;
grant execute on function public.submit_player_report(uuid, text, text) to authenticated;
grant execute on function public.get_my_profile() to authenticated;

grant execute on function public.admin_get_dashboard() to authenticated;
grant execute on function public.admin_search_players(text, int) to authenticated;
grant execute on function public.admin_get_player_detail(uuid) to authenticated;
grant execute on function public.admin_ban_user(uuid, text) to authenticated;
grant execute on function public.admin_unban_user(uuid, text) to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_flag_cheat(uuid, boolean, text) to authenticated;
grant execute on function public.admin_delete_leaderboard(uuid) to authenticated;
grant execute on function public.admin_wipe_market(uuid) to authenticated;
grant execute on function public.admin_reset_cloud_save(uuid) to authenticated;
grant execute on function public.admin_get_logs(int, text) to authenticated;
grant execute on function public.admin_list_players(text, int) to authenticated;
grant execute on function public.admin_list_saves(int) to authenticated;
grant execute on function public.admin_get_reports(text, int) to authenticated;
grant execute on function public.admin_review_report(uuid, text, text) to authenticated;
grant execute on function public.admin_list_announcements(int) to authenticated;
grant execute on function public.admin_create_announcement(text, text, text, int) to authenticated;
grant execute on function public.admin_toggle_announcement(uuid, boolean) to authenticated;
grant execute on function public.admin_get_config() to authenticated;
grant execute on function public.admin_set_config(text, jsonb) to authenticated;
grant execute on function public.admin_list_market(int) to authenticated;
grant execute on function public.admin_delete_listing(uuid) to authenticated;
grant execute on function public.admin_delete_buy_offer(uuid) to authenticated;
grant execute on function public.admin_list_leaderboard(text, int) to authenticated;
