-- ShieldMCP: Add alert deduplication columns and index

-- Add columns for dedup tracking
alter table public.alerts add column if not exists issue_key text;
alter table public.alerts add column if not exists recurrence_count integer not null default 1;
alter table public.alerts add column if not exists resolved_at timestamptz;
alter table public.alerts add column if not exists updated_at timestamptz not null default now();

-- Partial unique index: prevents duplicate active (unread) alerts for the same issue
-- Once a user marks the alert as read, the constraint no longer applies,
-- allowing a new alert to be created if the issue reappears.
create unique index if not exists alerts_active_dedup_idx
  on public.alerts (monitored_config_id, alert_type, issue_key)
  where read = false and issue_key is not null;
