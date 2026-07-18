-- Reset classement (parties reset) + garantir Veayce superadmin
-- + RPC wipe all pour le panneau admin

create or replace function public.admin_wipe_all_leaderboard()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n int;
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin requis';
  end if;
  delete from leaderboard_entries;
  get diagnostics n = row_count;
  perform public._admin_log('wipe_all_leaderboard', null, null, jsonb_build_object('deleted', n));
  return jsonb_build_object('ok', true, 'deleted', n);
end;
$$;

grant execute on function public.admin_wipe_all_leaderboard() to authenticated;

update profiles
set role = 'superadmin'
where display_name = 'Veayce';

delete from leaderboard_entries;
