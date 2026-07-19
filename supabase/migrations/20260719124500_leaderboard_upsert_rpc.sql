-- Upsert classement fiable (évite les échecs RLS / cache schéma côté client)
create or replace function public.upsert_my_leaderboard(
  p_display_name text,
  p_char_level int,
  p_max_job_level int,
  p_season int,
  p_total_earned bigint,
  p_seasons_completed int,
  p_total_harvests bigint,
  p_boss_kills_total int,
  p_kirha_current bigint
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := left(trim(coalesce(nullif(p_display_name, ''), 'Voyageur')), 40);
begin
  if v_uid is null then
    raise exception 'Non connecté';
  end if;
  if public.user_is_banned(v_uid) then
    raise exception 'Compte suspendu';
  end if;

  insert into public.leaderboard_entries as le (
    user_id, display_name, char_level, max_job_level, season,
    total_earned, seasons_completed, total_harvests, boss_kills_total, kirha_current, updated_at
  ) values (
    v_uid,
    v_name,
    greatest(1, least(500, coalesce(p_char_level, 1))),
    greatest(1, least(500, coalesce(p_max_job_level, 1))),
    greatest(1, coalesce(p_season, 1)),
    greatest(0, coalesce(p_total_earned, 0)),
    greatest(0, coalesce(p_seasons_completed, 0)),
    greatest(0, coalesce(p_total_harvests, 0)),
    greatest(0, coalesce(p_boss_kills_total, 0)),
    greatest(0, coalesce(p_kirha_current, 0)),
    now()
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    char_level = excluded.char_level,
    max_job_level = excluded.max_job_level,
    season = excluded.season,
    total_earned = excluded.total_earned,
    seasons_completed = excluded.seasons_completed,
    total_harvests = excluded.total_harvests,
    boss_kills_total = excluded.boss_kills_total,
    kirha_current = excluded.kirha_current,
    updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.upsert_my_leaderboard(text, int, int, int, bigint, int, bigint, int, bigint) to authenticated;

-- Recharge le classement depuis les saves cloud (tous joueurs non bannis)
create or replace function public.rebuild_leaderboard_from_saves()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare n int;
begin
  insert into public.leaderboard_entries (
    user_id, display_name, char_level, max_job_level, season,
    total_earned, seasons_completed, total_harvests, boss_kills_total, kirha_current, updated_at
  )
  select
    p.user_id,
    coalesce(nullif(p.display_name, ''), 'Voyageur'),
    greatest(1, coalesce((s.save_data->'character'->>'level')::int, 1)),
    greatest(1, coalesce((
      select max((j.value->>'level')::int)
      from jsonb_each(coalesce(s.save_data->'jobs', '{}'::jsonb)) j
    ), 1)),
    greatest(1, coalesce((s.save_data->>'season')::int, 1)),
    greatest(0, coalesce(
      (s.save_data->'lifetimeStats'->>'totalEarned')::bigint,
      (s.save_data->'stats'->>'totalEarned')::bigint,
      0
    )),
    greatest(0, coalesce((s.save_data->'lifetimeStats'->>'seasonsCompleted')::int, 0)),
    greatest(0, coalesce(
      (s.save_data->'lifetimeStats'->>'totalHarvests')::bigint,
      (s.save_data->'stats'->>'totalHarvests')::bigint,
      0
    )),
    greatest(0, coalesce((
      select sum((v.value)::int)
      from jsonb_each_text(coalesce(s.save_data->'bossKills', '{}'::jsonb)) v
    ), 0)::int),
    greatest(0, coalesce((s.save_data->>'kirha')::bigint, 0)),
    coalesce(s.updated_at, now())
  from profiles p
  join saves s on s.user_id = p.user_id
  where coalesce(p.is_banned, false) = false
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    char_level = excluded.char_level,
    max_job_level = excluded.max_job_level,
    season = excluded.season,
    total_earned = excluded.total_earned,
    seasons_completed = excluded.seasons_completed,
    total_harvests = excluded.total_harvests,
    boss_kills_total = excluded.boss_kills_total,
    kirha_current = excluded.kirha_current,
    updated_at = excluded.updated_at;

  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'upserted', n);
end;
$$;

grant execute on function public.rebuild_leaderboard_from_saves() to authenticated;

select public.rebuild_leaderboard_from_saves();
