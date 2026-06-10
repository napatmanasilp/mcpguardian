import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { clearCveCache } from "@/lib/scanner/cve-loader";

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET || "";
  if (authHeader === `Bearer ${expected}`) return true;
  if (cronHeader === expected) return true;
  return false;
}

const CreateCveSchema = z.object({
  cve_id: z.string().min(1),
  package_name: z.string().min(1),
  affected_versions: z.string().min(1),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
  description: z.string().min(1),
  fix: z.string().min(1),
  match_type: z.enum(["exact", "substring"]).default("exact"),
  version_field: z.enum(["semver", "all", "flag-check"]).default("semver"),
  is_active: z.boolean().default(true),
});

const UpdateCveSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean(),
});

export const POST = async (request: NextRequest) => {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateCveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(", ") }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("mcp_cves")
    .insert({
      cve_id: parsed.data.cve_id,
      package_name: parsed.data.package_name,
      affected_versions: parsed.data.affected_versions,
      severity: parsed.data.severity,
      description: parsed.data.description,
      fix: parsed.data.fix,
      match_type: parsed.data.match_type,
      version_field: parsed.data.version_field,
      is_active: parsed.data.is_active,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  clearCveCache();
  return NextResponse.json(data, { status: 201 });
};

export const PATCH = async (request: NextRequest) => {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpdateCveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(", ") }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("mcp_cves")
    .update({ is_active: parsed.data.is_active, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  clearCveCache();
  return NextResponse.json(data, { status: 200 });
};

export const GET = async () => {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("mcp_cves")
    .select("id, cve_id, package_name, affected_versions, severity, description, fix, match_type, version_field, is_active, created_at, updated_at")
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? [], { status: 200 });
};
