-- Colonne manquante qui faisait échouer tous les upserts classement
alter table public.leaderboard_entries
  add column if not exists max_job_level integer not null default 1;

create index if not exists leaderboard_max_job_level_idx
  on public.leaderboard_entries (max_job_level desc);
