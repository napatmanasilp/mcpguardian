/**
 * Applies all 13 migration files to Supabase via the Management API.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL  — e.g. https://xxx.supabase.co
 *   SUPABASE_ACESS_TOKEN       — Supabase personal access token (note: typo in name)
 *
 * Usage:
 *   npx tsx scripts/run-migrations.ts
 */

import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ──────────────────────────────────────────────────
function loadEnv() {
  try {
    const envPath = resolve(__dirname, "..", ".env.local");
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] = val;
    }
  } catch {
    // .env.local not found
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const accessToken = process.env.SUPABASE_ACESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;

if (!supabaseUrl || !accessToken) {
  console.error("\n❌ Missing environment variables.");
  console.error("   Ensure .env.local has:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL");
  console.error("   SUPABASE_ACESS_TOKEN (your Supabase personal access token)\n");
  process.exit(1);
}

const projectRef = supabaseUrl
  .replace("https://", "")
  .replace(".supabase.co", "");

const API_BASE = "https://api.supabase.com/v1";
const HEADERS = {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
};

// ── Run a single SQL block via the Management API ─────────────────────
async function runSql(sql: string): Promise<{ success: boolean; error?: string }> {
  const url = `${API_BASE}/projects/${projectRef}/database/query`;
  const body = JSON.stringify({ query: sql });

  const res = await fetch(url, {
    method: "POST",
    headers: HEADERS,
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed.error?.message || parsed.message || parsed.error || text;
    } catch { /* use raw text */ }
    return { success: false, error: detail };
  }

  return { success: true };
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  const migrationsDir = resolve(__dirname, "..", "supabase", "migrations");

  // Explicit list of all migration files in order (24 total)
  const MIGRATION_FILES = [
    "000_drop_old_tables.sql",
    "001_initial.sql",
    "001_plans.sql",
    "002_overage_rates.sql",
    "002_seed_cves.sql",
    "003_alert_dedup.sql",
    "003_organizations.sql",
    "004_organization_members.sql",
    "004_rug_pull_detection.sql",
    "005_api_keys.sql",
    "005_mcp_servers.sql",
    "006_check_cache.sql",
    "006_invocation_sequences.sql",
    "006_scans.sql",
    "007_invocation_logs.sql",
    "007_proxy_sessions.sql",
    "007_session_permissions.sql",
    "008_forensic_content.sql",
    "008_server_registry.sql",
    "008_tool_invocation_logs.sql",
    "009_active_sessions.sql",
    "009_alerts_webhooks.sql",
    "010_addons_billing.sql",
    "011_compliance.sql",
    "012_observability.sql",
    "013_rls_policies.sql",
    "014_increment_functions.sql",
  ];

  const newMigrations = MIGRATION_FILES.filter((f) =>
    readdirSync(migrationsDir).includes(f)
  );

  console.log(`\n📋 Found ${newMigrations.length} migration files to apply`);
  console.log(`   Project: ${projectRef}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const file of newMigrations) {
    const filePath = resolve(migrationsDir, file);
    const sql = readFileSync(filePath, "utf-8");

    // Estimate SQL size
    const sqlSizeKb = (Buffer.byteLength(sql, "utf-8") / 1024).toFixed(1);
    process.stdout.write(`  ${file} (${sqlSizeKb} KB) ... `);

    const result = await runSql(sql);

    if (result.success) {
      console.log("✅");
      successCount++;
    } else {
      console.log("❌");
      console.error(`\n     Error: ${result.error}\n`);
      failCount++;
      // Continue with remaining migrations; failed ones can be retried later
    }
  }

  console.log(`\n┌─────────────────────────────────────────────┐`);
  console.log(`│  ${successCount} succeeded, ${failCount} failed                         │`);
  console.log(`└─────────────────────────────────────────────┘\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main();
