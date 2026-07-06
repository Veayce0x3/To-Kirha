-- Compte : suppression, ban email, renommage gratuit (1×), historique pseudo

alter table profiles add column if not exists free_rename_used boolean not null default false;

create table if not exists banned_emails (
  email_lower text primary key,
  reason text,
  banned_at timestamptz not null default now(),
  banned_by uuid references auth.users(id) on delete set null,
  original_user_id uuid
);

create table if not exists display_name_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  old_name text not null,
  new_name text not null,
  change_type text not null default 'free' check (change_type in ('free', 'paid', 'admin', 'signup')),
  created_at timestamptz not null default now()
);

create index if not exists display_name_history_user_idx on display_name_history (user_id, created_at desc);

alter table public.banned_emails enable row level security;
alter table public.display_name_history enable row level security;

drop policy if exists "display_name_history select own" on public.display_name_history;
drop policy if exists "display_name_history staff select" on public.display_name_history;
create policy "display_name_history select own" on public.display_name_history
  for select using (auth.uid() = user_id);
create policy "display_name_history staff select" on public.display_name_history
  for select using (public.is_staff());

-- Bloque nouvelle inscription avec email banni
create or replace function public.check_email_not_banned()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.banned_emails where email_lower = lower(new.email)) then
    raise exception 'Cette adresse email est suspendue.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_banned_email on auth.users;
create trigger trg_check_banned_email
  before insert on auth.users
  for each row execute function public.check_email_not_banned();

-- Trigger protect : empêcher modification free_rename_used par le joueur
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
    if NEW.free_rename_used is distinct from OLD.free_rename_used then NEW.free_rename_used := OLD.free_rename_used; end if;
  end if;
  return NEW;
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
    'free_rename_used', v.free_rename_used,
    'admin_access', v.role in ('admin', 'superadmin'),
    'role', case when v.role in ('moderator', 'admin', 'superadmin') then v.role else null end
  );
end;
$$;

create or replace function public.change_my_display_name(p_new_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_old text;
  v_new text := trim(p_new_name);
  v_profile profiles%rowtype;
begin
  if v_uid is null then raise exception 'Non connecté'; end if;
  if char_length(v_new) < 3 or char_length(v_new) > 20 then
    raise exception 'Pseudo entre 3 et 20 caractères';
  end if;
  select * into v_profile from profiles where user_id = v_uid;
  if not found then raise exception 'Profil introuvable'; end if;
  if v_profile.is_banned then raise exception 'Compte suspendu'; end if;
  if v_profile.free_rename_used then raise exception 'Renommage gratuit déjà utilisé'; end if;
  if exists (
    select 1 from profiles
    where user_id != v_uid and lower(trim(display_name)) = lower(v_new)
  ) then
    raise exception 'Pseudo déjà pris';
  end if;
  v_old := v_profile.display_name;
  update profiles
  set display_name = v_new, free_rename_used = true, updated_at = now()
  where user_id = v_uid;
  update leaderboard_entries set display_name = v_new where user_id = v_uid;
  update market_sell_listings set seller_name = v_new where seller_id = v_uid and qty_remaining > 0;
  update market_buy_offers set buyer_name = v_new where buyer_id = v_uid and qty_remaining > 0;
  insert into display_name_history (user_id, old_name, new_name, change_type)
  values (v_uid, v_old, v_new, 'free');
  return jsonb_build_object('display_name', v_new, 'old_name', v_old, 'free_rename_used', true);
end;
$$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Non connecté'; end if;
  delete from auth.users where id = v_uid;
end;
$$;

create or replace function public.admin_ban_user(p_target uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_email text;
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  if p_target = auth.uid() then raise exception 'Tu ne peux pas te bannir toi-même'; end if;
  if not public.is_admin_or_above() and exists (
    select 1 from profiles where user_id = p_target and role in ('admin', 'superadmin')
  ) then raise exception 'Seul un admin peut bannir ce compte'; end if;
  select lower(email) into v_email from auth.users where id = p_target;
  update profiles set is_banned = true, banned_at = now(), banned_reason = left(p_reason, 500), banned_by = auth.uid()
  where user_id = p_target;
  if v_email is not null then
    insert into banned_emails (email_lower, reason, banned_by, original_user_id)
    values (v_email, left(p_reason, 500), auth.uid(), p_target)
    on conflict (email_lower) do update set
      reason = excluded.reason, banned_at = now(), banned_by = excluded.banned_by, original_user_id = excluded.original_user_id;
  end if;
  delete from leaderboard_entries where user_id = p_target;
  delete from market_sell_listings where seller_id = p_target;
  delete from market_buy_offers where buyer_id = p_target;
  perform public._admin_log('ban', p_target, p_reason);
end;
$$;

create or replace function public.admin_unban_user(p_target uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_email text;
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  select lower(email) into v_email from auth.users where id = p_target;
  update profiles set is_banned = false, banned_at = null, banned_reason = null, banned_by = null
  where user_id = p_target;
  if v_email is not null then
    delete from banned_emails where email_lower = v_email;
  end if;
  perform public._admin_log('unban', p_target, p_reason);
end;
$$;

create or replace function public.admin_get_player_detail(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles%rowtype;
  v_save jsonb;
  v_sells int;
  v_buys int;
  v_email text;
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  select * into v_profile from profiles where user_id = p_user_id;
  if not found then raise exception 'Joueur introuvable'; end if;
  select lower(email) into v_email from auth.users where id = p_user_id;
  select save_data into v_save from saves where user_id = p_user_id;
  select count(*) into v_sells from market_sell_listings where seller_id = p_user_id and qty_remaining > 0;
  select count(*) into v_buys from market_buy_offers where buyer_id = p_user_id and qty_remaining > 0;
  return jsonb_build_object(
    'profile', jsonb_build_object(
      'user_id', v_profile.user_id, 'display_name', v_profile.display_name,
      'role', v_profile.role, 'is_banned', v_profile.is_banned,
      'banned_at', v_profile.banned_at, 'banned_reason', v_profile.banned_reason,
      'cheat_flagged', v_profile.cheat_flagged, 'cheat_notes', v_profile.cheat_notes,
      'free_rename_used', v_profile.free_rename_used,
      'email', v_email, 'created_at', v_profile.created_at
    ),
    'name_history', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select old_name, new_name, change_type, created_at
        from display_name_history where user_id = p_user_id
        order by created_at desc limit 20
      ) t
    ), '[]'::jsonb),
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

grant execute on function public.change_my_display_name(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
