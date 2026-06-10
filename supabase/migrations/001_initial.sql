-- ShieldMCP initial schema
-- Run via: npx tsx scripts/apply-migrations.ts
-- Or paste into: https://supabase.com/dashboard/project/YOUR_REF/sql/new
-- Or verify setup at: http://localhost:3000/api/setup-check

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  plan text not null default 'free',
  stripe_customer_id text,
  scans_this_month integer not null default 0,
  max_scans integer not null default 3,
  created_at timestamptz not null default now()
);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  overall_grade char(1) not null check (overall_grade in ('A', 'B', 'C', 'D', 'F')),
  overall_score integer not null,
  servers_scanned integer not null,
  critical_issues integer not null default 0,
  high_issues integer not null default 0,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.monitored_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  config_json jsonb not null,
  last_scan_id uuid references public.scans (id) on delete set null,
  last_score integer,
  scan_frequency text not null default 'daily',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  monitored_config_id uuid not null references public.monitored_configs (id) on delete cascade,
  alert_type text not null,
  severity text not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.mcp_cves (
  id uuid primary key default gen_random_uuid(),
  cve_id text not null unique,
  package_name text not null,
  affected_versions text not null,
  fixed_version text,
  cvss_score decimal(3, 1) not null,
  severity text not null,
  description text not null,
  published_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index scans_user_id_idx on public.scans (user_id);
create index scans_created_at_idx on public.scans (created_at desc);

create index monitored_configs_user_id_idx on public.monitored_configs (user_id);

create index alerts_user_id_idx on public.alerts (user_id);
create index alerts_monitored_config_id_idx on public.alerts (monitored_config_id);
create index alerts_read_idx on public.alerts (user_id, read);

create index mcp_cves_package_name_idx on public.mcp_cves (package_name);
create index mcp_cves_cve_id_idx on public.mcp_cves (cve_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.scans enable row level security;
alter table public.monitored_configs enable row level security;
alter table public.alerts enable row level security;
alter table public.mcp_cves enable row level security;

-- profiles: users can read and update their own row
create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- scans: users can manage their own scans
create policy "Users can view own scans"
  on public.scans
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own scans"
  on public.scans
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own scans"
  on public.scans
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own scans"
  on public.scans
  for delete
  using (auth.uid() = user_id);

-- monitored_configs: users can manage their own configs
create policy "Users can view own monitored configs"
  on public.monitored_configs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own monitored configs"
  on public.monitored_configs
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own monitored configs"
  on public.monitored_configs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own monitored configs"
  on public.monitored_configs
  for delete
  using (auth.uid() = user_id);

-- alerts: users can manage their own alerts
create policy "Users can view own alerts"
  on public.alerts
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own alerts"
  on public.alerts
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own alerts"
  on public.alerts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own alerts"
  on public.alerts
  for delete
  using (auth.uid() = user_id);

-- mcp_cves: reference data — readable by authenticated users, no user writes
create policy "Authenticated users can view CVEs"
  on public.mcp_cves
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
