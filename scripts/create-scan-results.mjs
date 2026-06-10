import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const raw = readFileSync(".env.local", "utf8");
const env = {};
raw.split("\n").forEach((line) => {
  const i = line.indexOf("=");
  if (i > 0) {
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1);
    env[k] = v;
  }
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = SUPABASE_URL.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
console.log("Project ref:", PROJECT_REF);

// Check if table already exists via REST
const checkResp = await fetch(`${SUPABASE_URL}/rest/v1/scan_results?limit=1`, {
  headers: {
    "apikey": SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Accept": "application/json",
  },
});

if (checkResp.ok) {
  console.log("scan_results table already exists and is accessible");
  process.exit(0);
}

// Use the Supabase Management API to run SQL
// This requires the access token from .env.local
const MANAGEMENT_TOKEN = env.SUPABASE_ACESS_TOKEN;
if (!MANAGEMENT_TOKEN) {
  console.log("No SUPABASE_ACCESS_TOKEN found. Trying alternative approach...");
  
  // Alternative: Use creating a function via RPC
  // First, try to create a pgexecute function
  const sba = createClient(SUPABASE_URL, SERVICE_KEY);
  
  const createFunctionSQL = `
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
  `;
  
  // Try to create the exec_sql function via the SQL API
  // This uses Supabase's built-in /sql endpoint if available
  const sqlResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      "X-Supabase-Query-Execution": "true",
    },
    body: JSON.stringify({
      query: createFunctionSQL,
    }),
  });
  
  console.log("SQL endpoint response:", sqlResponse.status);
  
  // If that doesn't work, try creating the table directly via the
  // Supabase database through pg connection or management API
  if (sqlResponse.status === 404) {
    console.log("\nCannot execute SQL directly. Creating the table through code...");
    
    // The table will be created on first successful insert via the service_role key
    // Actually, Supabase REST API doesn't auto-create tables. 
    // We need to either:
    // 1. Use pg connection directly (requires connection string)
    // 2. Use Supabase CLI
    // 3. Use Supabase Management API with access token
    
    console.log("\n=== TABLE CREATION SQL ===");
    console.log("Run this SQL in the Supabase Dashboard SQL editor:");
    console.log(`
CREATE TABLE IF NOT EXISTS scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_grade TEXT,
  overall_score INTEGER,
  servers_scanned INTEGER DEFAULT 0,
  critical_issues INTEGER DEFAULT 0,
  high_issues INTEGER DEFAULT 0,
  medium_issues INTEGER DEFAULT 0,
  results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scan_results"
  ON scan_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scan_results"
  ON scan_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access scan_results"
  ON scan_results FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_scan_results_user ON scan_results(user_id, created_at DESC);
    `.trim());
    
    process.exit(0);
  }
}

// Try using Management API
console.log("Attempting to use Supabase Management API...");
const mgmtResponse = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MANAGEMENT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
CREATE TABLE IF NOT EXISTS scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_grade TEXT,
  overall_score INTEGER,
  servers_scanned INTEGER DEFAULT 0,
  critical_issues INTEGER DEFAULT 0,
  high_issues INTEGER DEFAULT 0,
  medium_issues INTEGER DEFAULT 0,
  results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scan_results"
  ON scan_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scan_results"
  ON scan_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access scan_results"
  ON scan_results FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_scan_results_user ON scan_results(user_id, created_at DESC);
      `,
    }),
  }
);

console.log("Management API response:", mgmtResponse.status);
const mgmtText = await mgmtResponse.text();
console.log("Response body:", mgmtText.substring(0, 500));

if (mgmtResponse.ok) {
  console.log("\nscan_results table created successfully!");
}
