-- Admin : donner des Kirha à un joueur (save cloud)
create or replace function public.admin_grant_kirha(p_user_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_save jsonb;
  v_kirha numeric;
  v_lifetime jsonb;
  v_earned numeric;
  v_now_ms bigint;
  v_amount numeric;
begin
  if not public.is_admin_or_above() then
    raise exception 'Accès refusé';
  end if;

  v_amount := coalesce(p_amount, 0);
  if v_amount = 0 then
    raise exception 'Montant invalide';
  end if;
  if abs(v_amount) > 100000000 then
    raise exception 'Montant trop élevé';
  end if;

  select save_data into v_save from saves where user_id = p_user_id;
  if v_save is null then
    raise exception 'Pas de save cloud pour ce joueur';
  end if;

  v_now_ms := (extract(epoch from now()) * 1000)::bigint;
  v_kirha := coalesce((v_save->>'kirha')::numeric, 0) + v_amount;
  if v_kirha < 0 then
    v_kirha := 0;
  end if;

  v_save := jsonb_set(v_save, '{kirha}', to_jsonb(v_kirha), true);

  if v_amount > 0 then
    v_lifetime := coalesce(v_save->'lifetimeStats', '{}'::jsonb);
    v_earned := coalesce((v_lifetime->>'totalEarned')::numeric, 0) + v_amount;
    v_lifetime := jsonb_set(v_lifetime, '{totalEarned}', to_jsonb(v_earned), true);
    v_save := jsonb_set(v_save, '{lifetimeStats}', v_lifetime, true);

    if v_save ? 'stats' then
      v_save := jsonb_set(
        v_save,
        '{stats,totalEarned}',
        to_jsonb(coalesce((v_save->'stats'->>'totalEarned')::numeric, 0) + v_amount),
        true
      );
    end if;
  end if;

  v_save := jsonb_set(v_save, '{lastOnline}', to_jsonb(v_now_ms), true);

  update saves
  set save_data = v_save,
      updated_at = now()
  where user_id = p_user_id;

  update leaderboard_entries
  set kirha_current = v_kirha,
      total_earned = case
        when v_amount > 0 then coalesce(total_earned, 0) + v_amount
        else total_earned
      end,
      updated_at = now()
  where user_id = p_user_id;

  perform public._admin_log(
    'grant_kirha',
    p_user_id,
    (case when v_amount > 0 then '+' else '' end) || trim(to_char(v_amount, '9999999990.99')) || ' Kirha'
  );

  return jsonb_build_object(
    'ok', true,
    'kirha', v_kirha,
    'amount', v_amount,
    'lastOnline', v_now_ms
  );
end;
$$;

grant execute on function public.admin_grant_kirha(uuid, numeric) to authenticated;
