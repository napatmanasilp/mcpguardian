-- Migration 003: Organizations Table
-- Multi-tenant orgs, each with its own plan, billing cycle, and usage counters.
-- Polar.sh customer/subscription IDs replace Stripe.

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan_id TEXT NOT NULL REFERENCES plans(id) DEFAULT 'free',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' | 'annual'
  -- Polar.sh identifiers replace Stripe identifiers
  polar_customer_id TEXT UNIQUE,           -- Polar customer ID
  polar_subscription_id TEXT UNIQUE,       -- Polar subscription ID
  subscription_status TEXT NOT NULL DEFAULT 'active',
    -- 'active' | 'trialing' | 'past_due' | 'canceled' | 'contact_us'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  scans_used_this_period INTEGER NOT NULL DEFAULT 0,
  tool_calls_used_this_period INTEGER NOT NULL DEFAULT 0,
  seats_used INTEGER NOT NULL DEFAULT 1,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  proxy_first_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
