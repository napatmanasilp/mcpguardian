-- Migration 018: Add logo_url and timezone columns to organizations
-- Required by MCPGuardian UX Improvements (Settings General page)

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
