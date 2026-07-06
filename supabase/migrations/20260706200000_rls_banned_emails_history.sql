-- RLS : banned_emails et display_name_history (alertes sécurité Supabase)

alter table public.banned_emails enable row level security;

-- Aucune policy : accès direct refusé (anon/authenticated).
-- Les triggers et RPC security definer continuent de fonctionner.

alter table public.display_name_history enable row level security;

drop policy if exists "display_name_history select own" on public.display_name_history;
drop policy if exists "display_name_history staff select" on public.display_name_history;

create policy "display_name_history select own" on public.display_name_history
  for select using (auth.uid() = user_id);

create policy "display_name_history staff select" on public.display_name_history
  for select using (public.is_staff());
