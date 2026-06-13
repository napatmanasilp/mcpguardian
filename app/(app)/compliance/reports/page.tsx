import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Download } from "lucide-react";

export const metadata: Metadata = {
  title: "Compliance Reports — MCPGuardian",
  description: "View and download compliance assessment reports.",
};

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

const ComplianceReportsPage = async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = createServiceClient();
  const { data: membership } = await svc
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("invitation_status", "accepted")
    .single();

  if (!membership) redirect("/onboarding");

  const { data: reports } = await svc
    .from("compliance_reports")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/compliance" className="hover:text-slate-300">Compliance</Link>
        <span>/</span>
        <span className="text-slate-300">Reports</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compliance Reports</h1>
          <p className="text-sm text-slate-500">Exported compliance documentation for audits</p>
        </div>
        <Link href="/api/compliance/reports/generate">
          <Button className="gap-2">
            <FileText className="size-4" />
            Generate Report
          </Button>
        </Link>
      </div>

      {reports && reports.length > 0 ? (
        <div className="space-y-2">
          {reports.map((report) => (
            <div key={report.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-4">
                <div className="size-8 rounded-lg bg-monitor/15 flex items-center justify-center">
                  <FileText className="size-4 text-monitor" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{report.report_type}</p>
                  <p className="text-xs text-slate-500">{new Date(report.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="border-white/10 gap-1.5">
                <Download className="size-3.5" />
                Download
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <FileText className="size-12 text-slate-600 mb-4" />
          <h2 className="text-lg font-semibold text-slate-300 mb-1">No reports yet</h2>
          <p className="text-sm text-slate-500 mb-6">Generate your first compliance report to download as PDF.</p>
          <Button className="gap-2">
            <FileText className="size-4" />
            Generate Report
          </Button>
        </div>
      )}
    </main>
  );
};

export default ComplianceReportsPage;
