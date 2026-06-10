-- Migration 009: Alerts & Webhooks Tables
-- Configurable alert rules per organization with multi-channel delivery
-- (email, webhook, Slack) and rate-limited delivery tracking.

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  trigger_event TEXT NOT NULL,
    -- 'threat_detected' | 'session_terminated_threat' | 'rug_pull_detected' |
    -- 'scan_completed_malicious' | 'tool_call_blocked' | 'watchdog_failed' |
    -- 'scan_limit_80pct' | 'tool_call_limit_80pct' | 'overage_started'
  severity_threshold TEXT,
  notification_channels JSONB NOT NULL DEFAULT '[]',
  cooldown_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'email' | 'webhook' | 'slack_webhook'
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alert_rule_id UUID REFERENCES alert_rules(id),
  channel_id UUID REFERENCES alert_channels(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_deliveries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_alert_rules_org ON alert_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_alert_channels_org ON alert_channels(organization_id);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_org ON alert_deliveries(organization_id, status);
