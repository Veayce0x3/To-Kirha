-- Retire le mode vitesse admin ; ajoute adminRevision pour empêcher
-- l’écrasement des dons Kirha/ressources par l’autosave du joueur.

create or replace function public.admin_adjust_player_save(
  p_user_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_save jsonb;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_kirha numeric;
  v_kirha_delta numeric := coalesce((v_payload->>'kirha_delta')::numeric, 0);
  v_inv jsonb;
  v_jobs jsonb;
  v_char jsonb;
  v_farm jsonb;
  v_key text;
  v_delta numeric;
  v_qty numeric;
  v_level int;
  v_set int;
  v_now_ms bigint;
  v_log text := '';
  v_lifetime jsonb;
  v_clear boolean := coalesce((v_payload->>'inventory_clear')::boolean, false);
  v_id text;
  v_admin_rev bigint;
begin
  if not public.is_admin_or_above() then
    raise exception 'Accès refusé';
  end if;

  select save_data into v_save from saves where user_id = p_user_id;
  if v_save is null then
    raise exception 'Pas de save cloud pour ce joueur';
  end if;

  v_now_ms := (extract(epoch from now()) * 1000)::bigint;

  -- Kirha
  if v_kirha_delta <> 0 then
    if abs(v_kirha_delta) > 100000000 then
      raise exception 'Montant Kirha trop élevé';
    end if;
    v_kirha := coalesce((v_save->>'kirha')::numeric, 0) + v_kirha_delta;
    if v_kirha < 0 then v_kirha := 0; end if;
    v_save := jsonb_set(v_save, '{kirha}', to_jsonb(v_kirha), true);
    if v_kirha_delta > 0 then
      v_lifetime := coalesce(v_save->'lifetimeStats', '{}'::jsonb);
      v_lifetime := jsonb_set(
        v_lifetime,
        '{totalEarned}',
        to_jsonb(coalesce((v_lifetime->>'totalEarned')::numeric, 0) + v_kirha_delta),
        true
      );
      v_save := jsonb_set(v_save, '{lifetimeStats}', v_lifetime, true);
      if v_save ? 'stats' then
        v_save := jsonb_set(
          v_save,
          '{stats,totalEarned}',
          to_jsonb(coalesce((v_save->'stats'->>'totalEarned')::numeric, 0) + v_kirha_delta),
          true
        );
      end if;
    end if;
    v_log := v_log || format(' kirha%+s', v_kirha_delta);
  else
    v_kirha := coalesce((v_save->>'kirha')::numeric, 0);
  end if;

  -- Inventaire : clear total
  v_inv := coalesce(v_save->'inventory', '{}'::jsonb);
  if v_clear then
    v_inv := '{}'::jsonb;
    v_log := v_log || ' clear_inv';
  end if;

  if jsonb_typeof(v_payload->'inventory_clear_ids') = 'array' then
    for v_id in select jsonb_array_elements_text(v_payload->'inventory_clear_ids')
    loop
      v_inv := v_inv - v_id;
    end loop;
    v_log := v_log || ' clear_ids';
  end if;

  if jsonb_typeof(v_payload->'inventory_deltas') = 'object' then
    for v_key, v_delta in
      select key, value::text::numeric
      from jsonb_each(v_payload->'inventory_deltas')
    loop
      if v_key is null or length(v_key) = 0 then continue; end if;
      if abs(v_delta) > 100000000 then
        raise exception 'Quantité ressource trop élevée: %', v_key;
      end if;
      v_qty := coalesce((v_inv->>v_key)::numeric, 0) + v_delta;
      if v_qty <= 0 then
        v_inv := v_inv - v_key;
      else
        v_inv := jsonb_set(v_inv, array[v_key], to_jsonb(v_qty), true);
      end if;
    end loop;
    v_log := v_log || ' inv_delta';
  end if;

  v_save := jsonb_set(v_save, '{inventory}', v_inv, true);

  -- Métiers : deltas
  v_jobs := coalesce(v_save->'jobs', '{}'::jsonb);
  if jsonb_typeof(v_payload->'job_level_deltas') = 'object' then
    for v_key, v_delta in
      select key, value::text::numeric
      from jsonb_each(v_payload->'job_level_deltas')
    loop
      v_level := coalesce((v_jobs->v_key->>'level')::int, 1) + trunc(v_delta)::int;
      if v_level < 1 then v_level := 1; end if;
      if v_level > 200 then v_level := 200; end if;
      v_jobs := jsonb_set(
        v_jobs,
        array[v_key],
        jsonb_set(
          jsonb_set(coalesce(v_jobs->v_key, '{}'::jsonb), '{level}', to_jsonb(v_level), true),
          '{xp}',
          to_jsonb(coalesce((v_jobs->v_key->>'xp')::numeric, 0)),
          true
        ),
        true
      );
    end loop;
    v_log := v_log || ' job_delta';
  end if;

  if jsonb_typeof(v_payload->'job_level_sets') = 'object' then
    for v_key, v_set in
      select key, value::text::int
      from jsonb_each(v_payload->'job_level_sets')
    loop
      v_level := greatest(1, least(200, v_set));
      v_jobs := jsonb_set(
        v_jobs,
        array[v_key],
        jsonb_set(
          jsonb_set(coalesce(v_jobs->v_key, '{}'::jsonb), '{level}', to_jsonb(v_level), true),
          '{xp}',
          to_jsonb(0),
          true
        ),
        true
      );
    end loop;
    v_log := v_log || ' job_set';
  end if;
  v_save := jsonb_set(v_save, '{jobs}', v_jobs, true);

  -- Perso
  v_char := coalesce(v_save->'character', '{}'::jsonb);
  if v_payload ? 'char_level_set' then
    v_level := greatest(1, least(200, coalesce((v_payload->>'char_level_set')::int, 1)));
    v_char := jsonb_set(jsonb_set(v_char, '{level}', to_jsonb(v_level), true), '{xp}', to_jsonb(0), true);
    v_log := v_log || format(' char_set=%s', v_level);
  elsif v_payload ? 'char_level_delta' then
    v_delta := coalesce((v_payload->>'char_level_delta')::numeric, 0);
    v_level := coalesce((v_char->>'level')::int, 1) + trunc(v_delta)::int;
    if v_level < 1 then v_level := 1; end if;
    if v_level > 200 then v_level := 200; end if;
    v_char := jsonb_set(jsonb_set(v_char, '{level}', to_jsonb(v_level), true), '{xp}', to_jsonb(coalesce((v_char->>'xp')::numeric, 0)), true);
    v_log := v_log || format(' char%+s', trunc(v_delta)::int);
  end if;
  v_save := jsonb_set(v_save, '{character}', v_char, true);

  -- Ferme
  v_farm := coalesce(v_save->'farmBuildingMeta', '{}'::jsonb);
  if jsonb_typeof(v_payload->'farm_level_deltas') = 'object' then
    for v_key, v_delta in
      select key, value::text::numeric
      from jsonb_each(v_payload->'farm_level_deltas')
    loop
      v_level := coalesce(((v_farm->v_key)->>'level')::int, 1) + trunc(v_delta)::int;
      if v_level < 1 then v_level := 1; end if;
      if v_level > 200 then v_level := 200; end if;
      v_farm := jsonb_set(
        v_farm,
        array[v_key],
        jsonb_set(
          jsonb_set(coalesce(v_farm->v_key, '{}'::jsonb), '{level}', to_jsonb(v_level), true),
          '{xp}',
          to_jsonb(coalesce(((v_farm->v_key)->>'xp')::numeric, 0)),
          true
        ),
        true
      );
    end loop;
    v_log := v_log || ' farm_delta';
  end if;
  v_save := jsonb_set(v_save, '{farmBuildingMeta}', v_farm, true);

  -- Plus de mode vitesse : nettoyer l’ancien champ
  v_save := v_save - 'speedMode';

  -- Révision admin : l’autosave joueur doit adopter ces champs s’il est en retard
  v_admin_rev := coalesce((v_save->>'adminRevision')::bigint, 0) + 1;
  v_save := jsonb_set(v_save, '{adminRevision}', to_jsonb(v_admin_rev), true);
  v_save := jsonb_set(v_save, '{adminPatchedAt}', to_jsonb(v_now_ms), true);
  v_save := jsonb_set(v_save, '{lastOnline}', to_jsonb(v_now_ms), true);

  update saves
  set save_data = v_save,
      updated_at = now()
  where user_id = p_user_id;

  update leaderboard_entries
  set kirha_current = v_kirha,
      char_level = coalesce((v_save->'character'->>'level')::int, char_level),
      total_earned = case
        when v_kirha_delta > 0 then coalesce(total_earned, 0) + v_kirha_delta
        else total_earned
      end,
      updated_at = now()
  where user_id = p_user_id;

  perform public._admin_log(
    'adjust_player_save',
    p_user_id,
    nullif(trim(v_log), '')
  );

  return jsonb_build_object(
    'ok', true,
    'kirha', v_kirha,
    'char_level', coalesce((v_save->'character'->>'level')::int, 1),
    'lastOnline', v_now_ms,
    'adminRevision', v_admin_rev,
    'log', trim(v_log)
  );
end;
$$;

grant execute on function public.admin_adjust_player_save(uuid, jsonb) to authenticated;

-- Même protection pour +1 métiers
create or replace function public.admin_grant_all_jobs_level(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_save jsonb;
  v_jobs jsonb;
  v_job_id text;
  v_level int;
  v_cap int := 200;
  v_farm jsonb;
  v_bid text;
  v_meta jsonb;
  v_farm_lv int;
  v_char jsonb;
  v_char_lv int;
  v_now_ms bigint;
  v_admin_rev bigint;
  v_all_jobs text[] := array[
    'lumberjack', 'fisher', 'miner', 'farmer', 'alchemist', 'toolmaker', 'cook', 'breeder'
  ];
  v_farm_buildings text[] := array[
    'chicken_coop', 'barn', 'sheepfold', 'pigsty', 'beehive'
  ];
begin
  if not public.is_admin_or_above() then
    raise exception 'Accès refusé';
  end if;

  select save_data into v_save from saves where user_id = p_user_id;
  if v_save is null then
    raise exception 'Pas de save cloud pour ce joueur';
  end if;

  v_now_ms := (extract(epoch from now()) * 1000)::bigint;
  v_jobs := coalesce(v_save->'jobs', '{}'::jsonb);

  foreach v_job_id in array v_all_jobs loop
    v_level := coalesce((v_jobs->v_job_id->>'level')::int, 1);
    if v_level < v_cap then
      v_jobs := jsonb_set(
        coalesce(v_jobs, '{}'::jsonb),
        array[v_job_id],
        jsonb_build_object(
          'level', v_level + 1,
          'xp', coalesce((v_jobs->v_job_id->>'xp')::numeric, 0)
        ),
        true
      );
    end if;
  end loop;

  v_farm := coalesce(v_save->'farmBuildingMeta', '{}'::jsonb);
  foreach v_bid in array v_farm_buildings loop
    v_meta := coalesce(v_farm->v_bid, '{}'::jsonb);
    v_farm_lv := coalesce((v_meta->>'level')::int, 1);
    if v_farm_lv < v_cap then
      v_meta := jsonb_set(v_meta, '{level}', to_jsonb(v_farm_lv + 1), true);
      if v_meta ? 'xp' is false then
        v_meta := jsonb_set(v_meta, '{xp}', '0'::jsonb, true);
      end if;
      v_farm := jsonb_set(v_farm, array[v_bid], v_meta, true);
    end if;
  end loop;

  v_char := coalesce(v_save->'character', '{"level":1,"xp":0}'::jsonb);
  v_char_lv := coalesce((v_char->>'level')::int, 1);
  if v_char_lv < v_cap then
    v_char := jsonb_set(v_char, '{level}', to_jsonb(v_char_lv + 1), true);
  end if;

  v_save := jsonb_set(v_save, '{jobs}', v_jobs, true);
  v_save := jsonb_set(v_save, '{farmBuildingMeta}', v_farm, true);
  v_save := jsonb_set(v_save, '{character}', v_char, true);
  v_save := v_save - 'speedMode';
  v_admin_rev := coalesce((v_save->>'adminRevision')::bigint, 0) + 1;
  v_save := jsonb_set(v_save, '{adminRevision}', to_jsonb(v_admin_rev), true);
  v_save := jsonb_set(v_save, '{adminPatchedAt}', to_jsonb(v_now_ms), true);
  v_save := jsonb_set(v_save, '{lastOnline}', to_jsonb(v_now_ms), true);

  update saves
  set save_data = v_save,
      updated_at = now()
  where user_id = p_user_id;

  perform public._admin_log('grant_all_jobs_level', p_user_id, '+1 métiers + ferme + perso');

  return jsonb_build_object(
    'ok', true,
    'jobs', v_jobs,
    'farmBuildingMeta', v_farm,
    'character', v_char,
    'lastOnline', v_now_ms,
    'adminRevision', v_admin_rev
  );
end;
$$;

grant execute on function public.admin_grant_all_jobs_level(uuid) to authenticated;

-- Fiche joueur sans speed mode
create or replace function public.admin_get_player_detail(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_profile profiles%rowtype;
  v_save jsonb;
  v_sells int;
  v_buys int;
  v_email text;
  v_inventory jsonb;
  v_jobs jsonb;
  v_farm jsonb;
  v_combat jsonb;
  v_res_key text;
  v_res_val numeric;
  v_owned jsonb;
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  select * into v_profile from profiles where user_id = p_user_id;
  if not found then raise exception 'Joueur introuvable'; end if;
  select lower(email) into v_email from auth.users where id = p_user_id;
  select save_data into v_save from saves where user_id = p_user_id;
  select count(*) into v_sells from market_sell_listings where seller_id = p_user_id and qty_remaining > 0;
  select count(*) into v_buys from market_buy_offers where buyer_id = p_user_id and qty_remaining > 0;

  v_inventory := '[]'::jsonb;
  begin
    if v_save is not null and jsonb_typeof(v_save->'inventory') = 'object' then
      for v_res_key, v_res_val in
        select key, (value)::numeric
        from jsonb_each_text(v_save->'inventory')
        where value ~ '^-?[0-9]+(\.[0-9]+)?$' and (value)::numeric > 0
        order by (value)::numeric desc
        limit 250
      loop
        v_inventory := v_inventory || jsonb_build_array(jsonb_build_object('id', v_res_key, 'qty', v_res_val));
      end loop;
    end if;
  exception when others then
    v_inventory := '[]'::jsonb;
  end;

  v_jobs := '{}'::jsonb;
  begin
    if v_save is not null and jsonb_typeof(v_save->'jobs') = 'object' then
      for v_res_key in select jsonb_object_keys(v_save->'jobs')
      loop
        v_jobs := v_jobs || jsonb_build_object(
          v_res_key,
          coalesce((v_save->'jobs'->v_res_key->>'level')::int, 1)
        );
      end loop;
    end if;
  exception when others then
    v_jobs := '{}'::jsonb;
  end;

  v_farm := '{}'::jsonb;
  begin
    if v_save is not null and jsonb_typeof(v_save->'farmBuildingMeta') = 'object' then
      for v_res_key in select jsonb_object_keys(v_save->'farmBuildingMeta')
      loop
        v_farm := v_farm || jsonb_build_object(
          v_res_key,
          coalesce((v_save->'farmBuildingMeta'->v_res_key->>'level')::int, 1)
        );
      end loop;
    end if;
  exception when others then
    v_farm := '{}'::jsonb;
  end;

  v_combat := '[]'::jsonb;
  begin
    v_owned := coalesce(v_save->'ownedCombatItems', '[]'::jsonb);
    if v_save is not null and jsonb_typeof(v_owned) = 'array' and jsonb_array_length(v_owned) > 0 then
      select coalesce(jsonb_agg(row_data), '[]'::jsonb) into v_combat
      from (
        select jsonb_build_object(
          'ref', ref_text,
          'item_id', coalesce(inst.item_id, ref_text),
          'rarity', coalesce(inst.rarity, 'common')
        ) as row_data
        from jsonb_array_elements_text(v_owned) as ref_text
        left join lateral (
          select elem->>'itemId' as item_id, elem->>'rarity' as rarity
          from jsonb_array_elements(
            case when jsonb_typeof(coalesce(v_save->'combatItemInstances', '[]'::jsonb)) = 'array'
              then coalesce(v_save->'combatItemInstances', '[]'::jsonb)
              else '[]'::jsonb end
          ) elem
          where elem->>'instanceId' = ref_text
          limit 1
        ) inst on true
      ) sub;
    end if;
  exception when others then
    v_combat := '[]'::jsonb;
  end;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'user_id', v_profile.user_id, 'display_name', v_profile.display_name,
      'role', v_profile.role, 'is_banned', v_profile.is_banned,
      'banned_at', v_profile.banned_at, 'banned_reason', v_profile.banned_reason,
      'cheat_flagged', v_profile.cheat_flagged, 'cheat_notes', v_profile.cheat_notes,
      'free_rename_used', v_profile.free_rename_used, 'email', v_email,
      'created_at', v_profile.created_at
    ),
    'name_history', coalesce((
      select jsonb_agg(row_to_json(h) order by h.created_at desc)
      from (
        select old_name, new_name, change_type, created_at
        from display_name_history
        where user_id = p_user_id
        order by created_at desc
        limit 20
      ) h
    ), '[]'::jsonb),
    'leaderboard', (select row_to_json(le) from leaderboard_entries le where le.user_id = p_user_id),
    'save_summary', case when v_save is null then null else jsonb_build_object(
      'kirha', coalesce(round(coalesce((v_save->>'kirha')::numeric, 0)), 0),
      'season', coalesce((v_save->>'season')::int, 1),
      'char_level', coalesce((v_save->'character'->>'level')::int, 1),
      'nickname', v_save->'character'->>'nickname',
      'last_online', v_save->>'lastOnline',
      'career_confirmed', coalesce((v_save->'careerChoice'->>'confirmed')::boolean, false),
      'career_harvest', v_save->'careerChoice'->>'harvest',
      'career_farm', v_save->'careerChoice'->>'farm',
      'career_weapon', v_save->'careerChoice'->>'weaponType',
      'career_team', v_save->'careerChoice'->>'teamWeaponTypes',
      'playtime_foreground_ms', coalesce(round(coalesce((v_save->'playtime'->>'foregroundMs')::numeric, 0))::bigint, 0),
      'playtime_background_ms', coalesce(round(coalesce((v_save->'playtime'->>'backgroundMs')::numeric, 0))::bigint, 0),
      'lifetime_earned', coalesce(round(coalesce((v_save->'lifetimeStats'->>'totalEarned')::numeric, 0)), 0),
      'season_earned', coalesce(round(coalesce((v_save->'stats'->>'totalEarned')::numeric, 0)), 0),
      'seasons_completed', coalesce((v_save->'lifetimeStats'->>'seasonsCompleted')::int, 0),
      'season_history', coalesce(v_save->'seasonHistory', '[]'::jsonb),
      'admin_revision', coalesce((v_save->>'adminRevision')::bigint, 0)
    ) end,
    'inventory_summary', v_inventory,
    'jobs_summary', v_jobs,
    'farm_summary', v_farm,
    'combat_items', v_combat,
    'market_sells_active', v_sells,
    'market_buys_active', v_buys,
    'reports_against', (select count(*) from player_reports where reported_user_id = p_user_id),
    'reports_by', (select count(*) from player_reports where reporter_id = p_user_id)
  );
end;
$$;

grant execute on function public.admin_get_player_detail(uuid) to authenticated;
