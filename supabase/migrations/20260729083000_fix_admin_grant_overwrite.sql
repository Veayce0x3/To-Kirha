-- Empêche l’écrasement des dons admin : inventaire en entiers,
-- et la save cloud fusionne toujours adminRevision avant écriture joueur.

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

  select save_data into v_save from saves where user_id = p_user_id for update;
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
      v_qty := trunc(coalesce((v_inv->>v_key)::numeric, 0) + v_delta);
      if v_qty <= 0 then
        v_inv := v_inv - v_key;
      else
        v_inv := jsonb_set(v_inv, array[v_key], to_jsonb(v_qty::bigint), true);
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

  v_save := v_save - 'speedMode';

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
