-- Garantit Veayce en superadmin + get_my_profile renvoie toujours le rôle
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
    'role', coalesce(nullif(v.role, ''), 'player')
  );
end;
$$;

grant execute on function public.get_my_profile() to authenticated;

update public.profiles
set role = 'superadmin'
where user_id = '4262ac27-fcc8-45b8-9251-0b42a1e6d148'
   or display_name ilike 'veayce';
