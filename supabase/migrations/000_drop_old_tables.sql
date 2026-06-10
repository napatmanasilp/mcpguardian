-- Migration 000: Drop Old Schema Tables
-- Drops all tables/views/functions from the old flat per-user schema
-- before applying the new multi-tenant organization-based schema.
-- Safe to re-run (all DROP IF EXISTS).

-- ── Views ────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS usage_summary;

-- ── Tables (old schema) ──────────────────────────────────────────────
-- Order matters: drop child tables first to avoid FK dependency errors

-- Phase 2-4 forensic/intermediate tables
DROP TABLE IF EXISTS invocation_content_store      CASCADE;
DROP TABLE IF EXISTS session_permissions            CASCADE;
DROP TABLE IF EXISTS session_anomalies              CASCADE;

-- Old per-user schema tables
DROP TABLE IF EXISTS active_sessions                CASCADE;
DROP TABLE IF EXISTS allowlist_config               CASCADE;
DROP TABLE IF EXISTS server_registry                CASCADE;
DROP TABLE IF EXISTS tool_definition_snapshots      CASCADE;
DROP TABLE IF EXISTS check_cache                    CASCADE;
DROP TABLE IF EXISTS alerts                         CASCADE;
DROP TABLE IF EXISTS monitored_configs              CASCADE;
DROP TABLE IF EXISTS api_keys                       CASCADE;
DROP TABLE IF EXISTS mcp_cves                       CASCADE;

-- Conflicting table names — must be dropped before new migrations create them
DROP TABLE IF EXISTS tool_invocation_logs           CASCADE;
DROP TABLE IF EXISTS scans                          CASCADE;

-- profiles depends on auth.users FK, drop last
DROP TABLE IF EXISTS profiles                       CASCADE;

-- ── Old functions ────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.handle_new_user()    CASCADE;
DROP FUNCTION IF EXISTS delete_old_invocation_logs();
DROP FUNCTION IF EXISTS delete_old_session_anomalies();
