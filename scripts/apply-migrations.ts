/**
 * Applies the Supabase migration SQL to your project.
 *
 * Usage:
 *   npx tsx scripts/apply-migrations.ts
 *
 * Requires these env vars in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
} catch {
  // .env.local not found, rely on existing env
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.log("\n❌ Missing environment variables.");
  console.log("   Make sure .env.local has:");
  console.log("   NEXT_PUBLIC_SUPABASE_URL");
  console.log("   SUPABASE_SERVICE_ROLE_KEY\n");
  process.exit(1);
}

const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");

console.log(`
┌─────────────────────────────────────────────────────────────┐
│                 MCPGuardian — Database Setup                │
└─────────────────────────────────────────────────────────────┘

Project: ${projectRef}

Option 1 — Supabase CLI (recommended):
  supabase db push

Option 2 — SQL Editor (easier):
  1. Go to https://supabase.com/dashboard/project/${projectRef}/sql/new
  2. Paste the contents of supabase/migrations/001_initial.sql
  3. Click "Run"

Option 3 — Verify setup:
  Visit http://localhost:3000/api/setup-check
  (after running the dev server)

After migration, verify by running:
  curl http://localhost:3000/api/setup-check
`);
