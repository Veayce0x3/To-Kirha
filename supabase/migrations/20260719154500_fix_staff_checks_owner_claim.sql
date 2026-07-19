-- Staff helpers + hardcode owner UUID + claim_owner_superadmin (Veayce)
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    auth.uid() = '4262ac27-fcc8-45b8-9251-0b42a1e6d148'::uuid
    or coalesce(
      (select role in ('moderator', 'admin', 'superadmin') from profiles where user_id = auth.uid()),
      false
    )
  );
$$;

create or replace function public.is_admin_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    auth.uid() = '4262ac27-fcc8-45b8-9251-0b42a1e6d148'::uuid
    or coalesce(
      (select role in ('admin', 'superadmin') from profiles where user_id = auth.uid()),
      false
    )
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    auth.uid() = '4262ac27-fcc8-45b8-9251-0b42a1e6d148'::uuid
    or coalesce(
      (select role = 'superadmin' from profiles where user_id = auth.uid()),
      false
    )
  );
$$;

create or replace function public.claim_owner_superadmin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid := '4262ac27-fcc8-45b8-9251-0b42a1e6d148';
begin
  if v_uid is null then
    raise exception 'Non connecté';
  end if;
  if v_uid <> v_owner then
    raise exception 'Accès refusé';
  end if;

  insert into profiles (user_id, display_name, role, is_banned)
  values (v_owner, 'Veayce', 'superadmin', false)
  on conflict (user_id) do update
    set role = 'superadmin',
        is_banned = false;

  return jsonb_build_object('ok', true, 'role', 'superadmin');
end;
$$;

grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin_or_above() to authenticated;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.claim_owner_superadmin() to authenticated;

update public.profiles
set role = 'superadmin', is_banned = false
where user_id = '4262ac27-fcc8-45b8-9251-0b42a1e6d148'
   or display_name ilike 'veayce';
