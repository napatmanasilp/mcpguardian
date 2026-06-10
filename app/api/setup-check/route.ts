import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const GET = async () => {
  const checks: Record<string, { status: string; details?: string }> = {};

  // Check 1: Environment variables
  checks.env = {
    status: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? "ok"
      : "missing NEXT_PUBLIC_SUPABASE_URL",
  };

  // Check 2: Auth
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      checks.auth = { status: "error", details: authError.message };
    } else if (user) {
      checks.auth = { status: "ok", details: `Authenticated as ${user.email}` };
    } else {
      checks.auth = { status: "unauthenticated", details: "No session (anonymous endpoint)" };
    }
  } catch (e) {
    checks.auth = { status: "error", details: String(e) };
  }

  // Check 3: Database tables (using service role for full visibility)
  try {
    const svc = createServiceClient();
    const tables = ["profiles", "scans", "monitored_configs", "alerts", "mcp_cves"];
    const results = await Promise.all(
      tables.map(async (table) => {
        const { count, error } = await svc
          .from(table)
          .select("*", { count: "exact", head: true });
        return { table, exists: !error, error: error?.message };
      })
    );

    const missing = results.filter((r) => !r.exists);
    if (missing.length === 0) {
      checks.database = { status: "ok", details: `All ${tables.length} tables found` };
    } else {
      checks.database = {
        status: "error",
        details: `Missing tables: ${missing.map((m) => m.table).join(", ")}. Run the SQL migration in supabase/migrations/001_initial.sql`,
      };
    }
  } catch (e) {
    checks.database = { status: "error", details: String(e) };
  }

  // Check 4: RLS policies
  try {
    const svc = createServiceClient();
    const { data: policies, error: rlsError } = await svc.rpc("get_policies");
    if (rlsError) {
      const { error: testError } = await svc.from("profiles").select("id").limit(1);
      checks.rls = {
        status: testError ? "warning" : "ok",
        details: testError
          ? "Cannot verify RLS (may need migration)"
          : "Table accessible via service role",
      };
    } else {
      checks.rls = { status: "ok", details: `Found ${(policies as unknown[])?.length || 0} policies` };
    }
  } catch (e) {
    checks.rls = { status: "warning", details: String(e) };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json(
    {
      healthy: allOk,
      timestamp: new Date().toISOString(),
      checks,
      migration: "Run: npx tsx scripts/apply-migrations.ts",
    },
  );
};
