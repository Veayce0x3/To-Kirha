-- Pseudo unique à l'inscription, inventaire admin, +1 tous métiers

create unique index if not exists profiles_display_name_lower_unique
  on public.profiles (lower(trim(display_name)));

create or replace function public.check_display_name_available(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_new text := trim(p_name);
begin
  if char_length(v_new) < 3 or char_length(v_new) > 20 then
    return false;
  end if;
  return not exists (
    select 1 from profiles
    where lower(trim(display_name)) = lower(v_new)
  );
end;
$$;

grant execute on function public.check_display_name_available(text) to anon, authenticated;

create or replace function public.create_profile_on_signup(p_display_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_new text := trim(p_display_name);
begin
  if v_uid is null then raise exception 'Non connecté'; end if;
  if char_length(v_new) < 3 or char_length(v_new) > 20 then
    raise exception 'Pseudo entre 3 et 20 caractères';
  end if;
  if exists (select 1 from profiles where user_id = v_uid) then
    return jsonb_build_object('display_name', (select display_name from profiles where user_id = v_uid));
  end if;
  if exists (
    select 1 from profiles where lower(trim(display_name)) = lower(v_new)
  ) then
    raise exception 'Pseudo déjà pris';
  end if;
  insert into profiles (user_id, display_name, updated_at)
  values (v_uid, v_new, now());
  insert into display_name_history (user_id, old_name, new_name, change_type)
  values (v_uid, '', v_new, 'signup');
  return jsonb_build_object('display_name', v_new);
end;
$$;

grant execute on function public.create_profile_on_signup(text) to authenticated;

create or replace function public.admin_grant_all_jobs_level(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_save jsonb;
  v_jobs jsonb;
  v_job_id text;
  v_level int;
  v_cap int := 200;
  v_all_jobs text[] := array[
    'lumberjack', 'fisher', 'miner', 'farmer', 'alchemist', 'toolmaker', 'cook'
  ];
begin
  if not public.is_admin_or_above() then raise exception 'Accès refusé'; end if;
  select save_data into v_save from saves where user_id = p_user_id;
  if v_save is null then raise exception 'Pas de save cloud pour ce joueur'; end if;

  v_jobs := coalesce(v_save->'jobs', '{}'::jsonb);
  foreach v_job_id in array v_all_jobs loop
    v_level := coalesce((v_jobs->v_job_id->>'level')::int, 1);
    if v_level < v_cap then
      v_jobs := jsonb_set(
        coalesce(v_jobs, '{}'::jsonb),
        array[v_job_id],
        jsonb_build_object('level', v_level + 1, 'xp', 0),
        true
      );
    end if;
  end loop;

  update saves
  set save_data = jsonb_set(v_save, '{jobs}', v_jobs, true),
      updated_at = now()
  where user_id = p_user_id;

  perform public._admin_log('grant_all_jobs_level', p_user_id, '+1 tous métiers');
  return jsonb_build_object('ok', true, 'jobs', v_jobs);
end;
$$;

grant execute on function public.admin_grant_all_jobs_level(uuid) to authenticated;

create or replace function public.admin_get_player_detail(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles%rowtype;
  v_save jsonb;
  v_sells int;
  v_buys int;
  v_inventory jsonb;
  v_jobs jsonb;
  v_combat jsonb;
  v_res_key text;
  v_res_val numeric;
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  select * into v_profile from profiles where user_id = p_user_id;
  if not found then raise exception 'Joueur introuvable'; end if;
  select save_data into v_save from saves where user_id = p_user_id;
  select count(*) into v_sells from market_sell_listings where seller_id = p_user_id and qty_remaining > 0;
  select count(*) into v_buys from market_buy_offers where buyer_id = p_user_id and qty_remaining > 0;

  v_inventory := '[]'::jsonb;
  if v_save is not null and v_save ? 'inventory' then
    for v_res_key, v_res_val in
      select key, (value)::numeric
      from jsonb_each_text(v_save->'inventory')
      where (value)::numeric > 0
      order by (value)::numeric desc
      limit 30
    loop
      v_inventory := v_inventory || jsonb_build_array(jsonb_build_object('id', v_res_key, 'qty', v_res_val));
    end loop;
  end if;

  v_jobs := '{}'::jsonb;
  if v_save is not null and v_save ? 'jobs' then
    for v_res_key in select jsonb_object_keys(v_save->'jobs')
    loop
      v_jobs := v_jobs || jsonb_build_object(
        v_res_key,
        coalesce((v_save->'jobs'->v_res_key->>'level')::int, 1)
      );
    end loop;
  end if;

  v_combat := '[]'::jsonb;
  if v_save is not null and jsonb_array_length(coalesce(v_save->'ownedCombatItems', '[]'::jsonb)) > 0 then
    select coalesce(jsonb_agg(row_data), '[]'::jsonb) into v_combat
    from (
      select jsonb_build_object(
        'ref', ref_text,
        'item_id', coalesce(inst.item_id, ref_text),
        'rarity', coalesce(inst.rarity, 'common')
      ) as row_data
      from jsonb_array_elements_text(v_save->'ownedCombatItems') as ref_text
      left join lateral (
        select elem->>'itemId' as item_id, elem->>'rarity' as rarity
        from jsonb_array_elements(coalesce(v_save->'combatItemInstances', '[]'::jsonb)) elem
        where elem->>'instanceId' = ref_text
        limit 1
      ) inst on true
    ) sub;
  end if;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'user_id', v_profile.user_id, 'display_name', v_profile.display_name,
      'role', v_profile.role, 'is_banned', v_profile.is_banned,
      'banned_at', v_profile.banned_at, 'banned_reason', v_profile.banned_reason,
      'cheat_flagged', v_profile.cheat_flagged, 'cheat_notes', v_profile.cheat_notes,
      'created_at', v_profile.created_at, 'free_rename_used', v_profile.free_rename_used
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
    'inventory_summary', v_inventory,
    'jobs_summary', v_jobs,
    'combat_items', v_combat,
    'market_sells_active', v_sells,
    'market_buys_active', v_buys,
    'reports_against', (select count(*) from player_reports where reported_user_id = p_user_id),
    'reports_by', (select count(*) from player_reports where reporter_id = p_user_id),
    'name_history', coalesce((
      select jsonb_agg(row_to_json(h) order by h.created_at desc)
      from (
        select old_name, new_name, change_type, created_at
        from display_name_history
        where user_id = p_user_id
        order by created_at desc
        limit 20
      ) h
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.admin_get_player_detail(uuid) to authenticated;
