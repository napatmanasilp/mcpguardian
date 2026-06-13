-- Migration: Create invoices and pdf_generation_requests tables

CREATE TABLE IF NOT EXISTS invoices (
  id                  TEXT PRIMARY KEY,
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount_paid         INTEGER NOT NULL,   -- in cents
  currency            TEXT NOT NULL DEFAULT 'usd',
  status              TEXT NOT NULL,      -- 'paid' | 'open' | 'void'
  hosted_invoice_url  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdf_generation_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'done' | 'failed'
  pdf_url         TEXT,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
