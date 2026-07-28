create table if not exists public.job_match_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary_domain text not null default '',
  career_level text not null default '',
  location text not null default '',
  work_preference text not null default 'both',
  job_titles text[] not null default '{}',
  industries text[] not null default '{}',
  result_count integer not null default 0 check (result_count >= 0)
);

create index if not exists job_match_searches_user_created_idx
  on public.job_match_searches(user_id, created_at desc);

alter table public.job_match_searches enable row level security;

create policy "Users can read their own job match searches"
  on public.job_match_searches for select
  using (auth.uid() = user_id);

create policy "Users can insert their own job match searches"
  on public.job_match_searches for insert
  with check (auth.uid() = user_id);
