-- Admin : métiers cuisine baker / fishmonger / chemist (remplace cook)

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
    'lumberjack', 'fisher', 'miner', 'farmer', 'alchemist', 'toolmaker',
    'baker', 'fishmonger', 'chemist', 'breeder'
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

  -- Migrer ancien cook → baker si présent
  if v_jobs ? 'cook' and (v_jobs ? 'baker') is false then
    v_jobs := jsonb_set(v_jobs, '{baker}', v_jobs->'cook', true);
  end if;
  v_jobs := v_jobs - 'cook';

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

  update saves set save_data = v_save, updated_at = now() where user_id = p_user_id;

  perform public._admin_log('grant_all_jobs_level', p_user_id, 'cuisine jobs baker/fishmonger/chemist');

  return jsonb_build_object('ok', true, 'adminRevision', v_admin_rev);
end;
$$;

grant execute on function public.admin_grant_all_jobs_level(uuid) to authenticated;
