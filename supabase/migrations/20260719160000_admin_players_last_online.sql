-- Liste / recherche joueurs : dernière connexion (save lastOnline + save.updated_at)
create or replace function public.admin_search_players(p_query text, p_limit int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := trim(coalesce(p_query, ''));
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  if length(v_q) < 2 then raise exception 'Requête trop courte (min 2 car.)'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select
        p.user_id,
        p.display_name,
        p.role,
        p.is_banned,
        p.cheat_flagged,
        p.created_at,
        le.char_level,
        le.season,
        le.total_earned,
        le.kirha_current,
        case
          when (s.save_data->>'lastOnline') ~ '^[0-9]+$'
            then ((s.save_data->>'lastOnline')::bigint)
          else null
        end as last_online,
        s.updated_at as save_updated_at
      from profiles p
      left join leaderboard_entries le on le.user_id = p.user_id
      left join saves s on s.user_id = p.user_id
      where p.display_name ilike '%' || v_q || '%'
         or p.user_id::text ilike v_q || '%'
      order by p.display_name
      limit least(greatest(p_limit, 1), 100)
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_list_players(p_filter text default 'recent', p_limit int default 40)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'Accès refusé'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select
        p.user_id,
        p.display_name,
        p.role,
        p.is_banned,
        p.cheat_flagged,
        p.created_at,
        le.char_level,
        le.season,
        le.total_earned,
        le.kirha_current,
        case
          when (s.save_data->>'lastOnline') ~ '^[0-9]+$'
            then ((s.save_data->>'lastOnline')::bigint)
          else null
        end as last_online,
        s.updated_at as save_updated_at
      from profiles p
      left join leaderboard_entries le on le.user_id = p.user_id
      left join saves s on s.user_id = p.user_id
      where case p_filter
        when 'banned' then p.is_banned
        when 'flagged' then p.cheat_flagged
        when 'staff' then p.role in ('moderator', 'admin', 'superadmin')
        when 'new' then true
        else true
      end
      order by
        case
          when p_filter = 'new' then extract(epoch from p.created_at)
          when p_filter in ('recent', 'active', '') or p_filter is null then
            coalesce(
              case when (s.save_data->>'lastOnline') ~ '^[0-9]+$'
                then (s.save_data->>'lastOnline')::double precision / 1000.0
                else null end,
              extract(epoch from s.updated_at),
              extract(epoch from p.created_at)
            )
          else null
        end desc nulls last,
        p.display_name
      limit least(greatest(p_limit, 1), 100)
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_search_players(text, int) to authenticated;
grant execute on function public.admin_list_players(text, int) to authenticated;
