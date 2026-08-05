-- Classement : total des découvertes d’événements Kirha (lifetime)
alter table public.leaderboard_entries
  add column if not exists total_discoveries bigint not null default 0;

create index if not exists leaderboard_total_discoveries_idx
  on public.leaderboard_entries (total_discoveries desc);

-- Nouvelle signature RPC (ajoute p_total_discoveries)
drop function if exists public.upsert_my_leaderboard(text, int, int, int, bigint, int, bigint, int, bigint);

create or replace function public.upsert_my_leaderboard(
  p_display_name text,
  p_char_level int,
  p_max_job_level int,
  p_season int,
  p_total_earned bigint,
  p_seasons_completed int,
  p_total_harvests bigint,
  p_boss_kills_total int,
  p_kirha_current bigint,
  p_total_discoveries bigint default 0
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
    total_earned, seasons_completed, total_harvests, boss_kills_total,
    kirha_current, total_discoveries, updated_at
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
    greatest(0, coalesce(p_total_discoveries, 0)),
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
    total_discoveries = excluded.total_discoveries,
    updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.upsert_my_leaderboard(text, int, int, int, bigint, int, bigint, int, bigint, bigint) to authenticated;
