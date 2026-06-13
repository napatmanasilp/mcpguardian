import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, ChevronRight, FileText, Plus, Shield, ShieldAlert, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Setup Complete — MCPGuardian",
  description: "Your MCPGuardian organization setup is complete.",
};

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { OnboardingSteps } from "@/components/onboarding/onboarding-steps";
import { SuccessAnimation } from "@/components/onboarding/success-animation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ proxy?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const svc = createServiceClient();

  // Fetch org membership
  const { data: membership } = await svc
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("invitation_status", "accepted")
    .single();

  if (!membership) redirect("/onboarding");

  const orgId = membership.organization_id;

  // Fetch the most recent scan for this organization
  const { data: latestScan } = await svc
    .from("scans")
    .select("id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Derive scan target link
  const scanTarget = latestScan ? `/reports/${latestScan.id}` : "/servers";

  const params = await searchParams;
  const proxyConnected = params.proxy === "connected";

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg border-white/10" style={{ background: "var(--bg-surface)" }}>
        <CardHeader className="text-center">
          <OnboardingSteps currentStep={3} />

          {/* Success animation — shown only when proxy=connected */}
          <SuccessAnimation show={proxyConnected} />

          {!proxyConnected && (
            <div className="mx-auto mb-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/20 mx-auto">
                <Shield className="size-8 text-emerald-400" />
              </div>
            </div>
          )}

          <CardTitle className="text-xl">
            {proxyConnected
              ? "MCPGuardian is now protecting your agent"
              : "Pre-connect scanning is active"}
          </CardTitle>
          <CardDescription>
            {proxyConnected
              ? "Your servers are being scanned and monitored for security threats."
              : "Set up the proxy connection to enable runtime protection."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Protection badges */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
              <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/20">
                <Check className="size-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-300">Pre-connect scanning</p>
                <p className="text-xs text-white/50">
                  All servers are scanned and verified before connection
                </p>
              </div>
              <Badge className="bg-emerald-500/15 border-emerald-500/30 text-emerald-400 text-[10px] ml-auto shrink-0">
                Active
              </Badge>
            </div>
            <div
              className={`flex items-center gap-3 rounded-lg p-4 border ${
                proxyConnected
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : "bg-amber-500/10 border-amber-500/20"
              }`}
            >
              <div
                className={`flex size-8 items-center justify-center rounded-full ${
                  proxyConnected ? "bg-emerald-500/20" : "bg-amber-500/20"
                }`}
              >
                {proxyConnected ? (
                  <Check className="size-4 text-emerald-400" />
                ) : (
                  <ShieldAlert className="size-4 text-amber-400" />
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${proxyConnected ? "text-emerald-300" : "text-amber-300"}`}>
                  Runtime proxy protection
                </p>
                <p className="text-xs text-white/50">
                  {proxyConnected
                    ? "Active — intercepting and monitoring tool calls"
                    : "Not yet connected — configure your MCP client to enable"}
                </p>
              </div>
              <Badge
                className={`text-[10px] shrink-0 ${
                  proxyConnected
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    : "bg-amber-500/15 border-amber-500/30 text-amber-400"
                }`}
              >
                {proxyConnected ? "Connected" : "Pending"}
              </Badge>
            </div>
          </div>

          {/* "What now?" next-step cards — always visible */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white/70 text-center">What now?</h3>
            <div className="grid gap-2">
              <Link
                href={scanTarget}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors group"
              >
                <div className="flex size-8 items-center justify-center rounded-full bg-blue-500/20">
                  <FileText className="size-4 text-blue-400" />
                </div>
                <span className="flex-1 text-sm font-medium text-white/80">View scan report</span>
                <ChevronRight className="size-4 text-white/30 group-hover:text-white/60 transition-colors" />
              </Link>

              <Link
                href="/servers/new"
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors group"
              >
                <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/20">
                  <Plus className="size-4 text-emerald-400" />
                </div>
                <span className="flex-1 text-sm font-medium text-white/80">Add another server</span>
                <ChevronRight className="size-4 text-white/30 group-hover:text-white/60 transition-colors" />
              </Link>

              <Link
                href="/settings/team"
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors group"
              >
                <div className="flex size-8 items-center justify-center rounded-full bg-purple-500/20">
                  <Users className="size-4 text-purple-400" />
                </div>
                <span className="flex-1 text-sm font-medium text-white/80">Invite a teammate</span>
                <ChevronRight className="size-4 text-white/30 group-hover:text-white/60 transition-colors" />
              </Link>
            </div>
          </div>

          {/* Contextual message */}
          <p className="text-sm text-white/40 text-center">
            {proxyConnected
              ? "You're all set. Your first MCP server is registered, scanned, and proxied."
              : "Your server was scanned. Connect the proxy to enable full runtime protection."}
          </p>

          {/* Proxy setup CTA — only when proxy is not connected */}
          {!proxyConnected && (
            <div className="flex gap-3">
              <Link
                href="/onboarding/proxy-setup"
                className="flex-1 inline-flex items-center justify-center rounded-md border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Complete Proxy Setup →
              </Link>
              <Link
                href="/dashboard"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90 transition-colors"
              >
                Go to Dashboard <ChevronRight className="size-4" />
              </Link>
            </div>
          )}
          {proxyConnected && (
            <Link
              href="/dashboard"
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90 transition-colors"
            >
              Explore Dashboard <ChevronRight className="size-4" />
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
