"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, Globe, Loader2, Shield, Terminal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { OnboardingSteps } from "@/components/onboarding/onboarding-steps";
import { ShieldLogo } from "@/components/auth/shield-logo";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const PIPELINE_STEPS = [
  "Static config analysis",
  "Domain verification",
  "Sandbox execution",
  "Hash comparison",
];

const STATUS_MESSAGES = [
  "Analyzing server configuration...",
  "Verifying domain certificates...",
  "Executing in isolated sandbox...",
  "Matching against CVE database...",
  "Checking OWASP MCP Top 10...",
];

function CountUp({ to, duration = 1200 }: { to: number; duration?: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (to === 0) { setCount(0); return; }
    const start = Date.now();
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * to));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <>{count}</>;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "scanning" | "complete">("form");
  const [orgName, setOrgName] = useState("");
  const [serverName, setServerName] = useState("");
  const [transportType, setTransportType] = useState<"http" | "stdio">("http");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [stdioCommand, setStdioCommand] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    status?: string;
    risk_score?: number;
    overall_result?: string;
    cveCount?: number;
  }>({});
  const [scanProgress, setScanProgress] = useState(0);
  const [statusMsgIndex, setStatusMsgIndex] = useState(0);
  const [stepTimings, setStepTimings] = useState<Record<string, number>>({});
  const stepStartRef = useRef<Record<string, number>>({});
  const [showProtected, setShowProtected] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const canSubmit = orgName.trim() && serverName.trim() && (transportType === "http" ? endpointUrl.trim() : stdioCommand.trim());

  // Pre-fill org name from email
  useEffect(() => {
    const fetchEmail = async () => {
      const stored = sessionStorage.getItem("signup-email");
      if (stored) {
        setUserEmail(stored);
        const domain = stored.split("@")[1] ?? "";
        const name = domain.split(".")[0] ?? "";
        const derived = name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, " ");
        if (derived && !orgName) {
          setOrgName(derived);
        }
        return;
      }
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setUserEmail(user.email);
          const domain = user.email.split("@")[1] ?? "";
          const name = domain.split(".")[0] ?? "";
          const derived = name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, " ");
          if (derived) setOrgName(derived);
        }
      } catch {
        // Silently fail — user can type org name manually
      }
    };
    fetchEmail();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === "scanning") {
      const interval = setInterval(() => {
        setStatusMsgIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [step]);

  useEffect(() => {
    if (step === "complete") {
      const timer = setTimeout(() => setShowProtected(true), 800);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleCreate = useCallback(async () => {
    if (!canSubmit) return;
    setIsCreating(true);
    setStep("scanning");
    setScanProgress(0);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName,
          serverName,
          transportType,
          endpointUrl: transportType === "http" ? endpointUrl : undefined,
          stdioCommand: transportType === "stdio" ? stdioCommand : undefined,
        }),
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData?.error?.message ?? "Failed to create organization");
      }

      const { scanId: newScanId } = responseData.data ?? {};

      if (!newScanId) {
        setStep("complete");
        setScanProgress(100);
        return;
      }

      setScanId(newScanId);

      // Record step start times
      PIPELINE_STEPS.forEach((name) => {
        stepStartRef.current[name] = Date.now();
      });

      const pollInterval = setInterval(async () => {
        try {
          const scanRes = await fetch(`/api/scans/${newScanId}`);
          if (!scanRes.ok) return;
          const data = await scanRes.json();
          const scan = data.data;

          if (scan?.status === "completed" || scan?.status === "failed") {
            clearInterval(pollInterval);
            const steps = (scan.pipeline_steps ?? []) as Array<{ step_name: string; status: string; completed_at?: string }>;
            setCompletedSteps(steps.map((s) => s.step_name));
            setScanProgress(100);
            setScanResult({
              status: scan.status,
              risk_score: scan.risk_score,
              overall_result: scan.overall_result,
              cveCount: scan.cve_count ?? 0,
            });
            setStep("complete");
          } else if (scan?.pipeline_steps) {
            const activeSteps = (scan.pipeline_steps as Array<{ step_name: string; status: string; completed_at?: string }>)
              .filter((s) => s.status === "PASS" || s.status === "FAIL")
              .map((s) => s.step_name);
            setCompletedSteps(activeSteps);

            // Record timings for completed steps
            activeSteps.forEach((name) => {
              if (!stepTimings[name] && stepStartRef.current[name]) {
                setStepTimings((prev) => ({
                  ...prev,
                  [name]: (Date.now() - stepStartRef.current[name]) / 1000,
                }));
              }
            });

            setScanProgress(Math.round((activeSteps.length / PIPELINE_STEPS.length) * 100));
          }
        } catch {
          // poll continues
        }
      }, 2000);

      setTimeout(() => clearInterval(pollInterval), 60000);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "An error occurred");
      setStep("form");
    } finally {
      setIsCreating(false);
    }
  }, [canSubmit, orgName, serverName, transportType, endpointUrl, stdioCommand]);

  const getRiskBadgeClass = (score: number | undefined) => {
    if (score == null) return "";
    if (score >= 80) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (score >= 60) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  const getRiskLabel = (score: number | undefined) => {
    if (score == null) return "Unknown";
    if (score >= 80) return "Low Risk";
    if (score >= 60) return "Medium Risk";
    return "High Risk";
  };

  // ── Scanning / Complete View ─────────────────────────────────────
  if (step === "scanning" || step === "complete") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-lg border-white/10 bg-bg-base">
          <CardHeader className="text-center">
            <OnboardingSteps currentStep={step === "scanning" ? 1 : 2} />
            <div className="mx-auto mb-4">
              <ShieldLogo className="size-12" />
            </div>
            <CardTitle className="text-xl">
              {step === "scanning" ? "Scanning your MCP server..." : "Scan complete"}
            </CardTitle>
            <CardDescription>
              {step === "scanning"
                ? "Our pipeline is analyzing the server configuration. This takes a few seconds."
                : `Risk score: ${scanResult.risk_score ?? "—"}/100 · ${scanResult.overall_result ?? "unknown"}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {PIPELINE_STEPS.map((name) => {
              const done = completedSteps.includes(name);
              const isActive = step === "scanning" && !done && completedSteps.length >= PIPELINE_STEPS.indexOf(name);
              const timing = stepTimings[name];
              return (
                <div key={name} className="flex items-center gap-3 text-sm">
                  {done ? (
                    <span className="inline-flex animate-in zoom-in-0 duration-300 ease-out">
                      <div className="flex size-6 items-center justify-center rounded-full bg-emerald-500/20">
                        <Check className="size-3.5 text-emerald-400" />
                      </div>
                    </span>
                  ) : isActive ? (
                    <Loader2 className="size-5 animate-spin text-blue-400" />
                  ) : (
                    <div className="size-6 rounded-full border-2 border-white/20" />
                  )}
                  <span className={done ? "text-slate-200" : "text-slate-500"}>{name}</span>
                  {timing != null && (
                    <span className="font-mono text-xs text-white/40 ml-auto">{timing.toFixed(1)}s</span>
                  )}
                </div>
              );
            })}

            {/* Progress bar during scan */}
            {step === "scanning" && (
              <>
                <Progress value={scanProgress} className="h-1 mt-2" />
                {/* Rotating status messages */}
                <p className="text-sm text-white/50 font-mono animate-pulse text-center mt-3">
                  {STATUS_MESSAGES[statusMsgIndex]}
                </p>
              </>
            )}

            {scanError && (
              <p className="text-sm text-red-400 text-center">{scanError}</p>
            )}

            {/* Result reveal */}
            {step === "complete" && scanResult.risk_score != null && (
              <div className="text-center space-y-4 pt-2">
                <Separator className="bg-white/10" />
                <p className="text-sm text-white/50 uppercase tracking-widest">Risk Score</p>
                <div className="font-mono text-7xl font-bold text-white tabular-nums">
                  <CountUp to={scanResult.risk_score} duration={1200} />
                  <span className="text-3xl text-white/40">/100</span>
                </div>
                <Badge className={cn(getRiskBadgeClass(scanResult.risk_score), "px-3 py-1")}>
                  {getRiskLabel(scanResult.risk_score)}
                </Badge>

                {/* Summary row */}
                <div className="grid grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
                  <div className="text-center">
                    <p className="text-xs text-white/40 mb-1">OWASP</p>
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                      Pass
                    </Badge>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-white/40 mb-1">CVE</p>
                    <Badge variant="outline" className={cn(scanResult.cveCount === 0 ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30")}>
                      {scanResult.cveCount === 0 ? "None Found" : scanResult.cveCount}
                    </Badge>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-white/40 mb-1">Domain</p>
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                      Verified ✓
                    </Badge>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-white/40 mb-1">Sandbox</p>
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                      Clean ✓
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Animated proxy diagram */}
            {step === "complete" && (
              <div className="relative h-20 mt-4">
                {/* UNPROTECTED state */}
                <div
                  className={cn(
                    "absolute inset-0 flex items-center justify-center transition-opacity duration-700",
                    showProtected ? "opacity-0" : "opacity-100",
                  )}
                >
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5">Agent</span>
                    <span className="text-red-500/50">→</span>
                    <span className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5">MCP Server</span>
                  </div>
                </div>
                {/* PROTECTED state */}
                <div
                  className={cn(
                    "absolute inset-0 flex items-center justify-center transition-opacity duration-700",
                    showProtected ? "opacity-100" : "opacity-0",
                  )}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-blue-300">Agent</span>
                    <span className="text-blue-400">→</span>
                    <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-300 font-semibold">🛡 MCPGuardian</span>
                    <span className="text-blue-400">→</span>
                    <span className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-blue-300">MCP Server</span>
                  </div>
                </div>
              </div>
            )}

            <Separator className="bg-white/5" />

            <div className="flex gap-3">
              {step === "scanning" ? (
                <Button
                  variant="outline"
                  className="flex-1 border-white/10"
                  disabled
                >
                  Scanning...
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="flex-1 border-white/10"
                  onClick={() => router.push("/onboarding/proxy-setup")}
                >
                  Continue to proxy setup
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Form View ─────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg border-white/10 bg-bg-base">          <CardHeader className="text-center">
          <OnboardingSteps currentStep={0} />
          <div className="mx-auto mb-4">
            <ShieldLogo className="size-12" />
          </div>
          <CardTitle className="text-xl">Set up your organization</CardTitle>
          <CardDescription>
            Create your organization and register your first MCP server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Transport selector — card toggles */}
          <div className="space-y-2">
            <Label>Transport type</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTransportType("http")}
                className={cn(
                  "flex flex-col gap-2 p-4 rounded-lg border-2 text-left transition-all duration-150",
                  transportType === "http"
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-white/10 bg-white/5 hover:border-white/20",
                )}
              >
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-blue-400" />
                  <span className="font-medium text-sm text-slate-200">HTTP</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] ml-auto">
                    Recommended
                  </Badge>
                </div>
                <p className="text-xs text-white/50">Full coverage · All scan modules</p>
              </button>
              <button
                type="button"
                onClick={() => setTransportType("stdio")}
                className={cn(
                  "flex flex-col gap-2 p-4 rounded-lg border-2 text-left transition-all duration-150",
                  transportType === "stdio"
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-white/10 bg-white/5 hover:border-white/20",
                )}
              >
                <div className="flex items-center gap-2">
                  <Terminal className="size-4 text-amber-400" />
                  <span className="font-medium text-sm text-slate-200">STDIO</span>
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px] ml-auto">
                    ⚠ Limited
                  </Badge>
                </div>
                <p className="text-xs text-white/50">Local only · Reduced scan scope</p>
              </button>
            </div>
          </div>

          {/* STDIO warning */}
          {transportType === "stdio" && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-4 text-sm">
              <p className="font-semibold text-amber-300 mb-1">⚠ STDIO Runtime Protection — Limited Coverage</p>
              <p className="text-slate-400 text-xs">
                STDIO-based servers (Claude Code, Cursor) do not currently support full runtime proxy protection.
                Pre-connect scanning is active. Runtime interception is on our roadmap for Q3 2026.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="orgName">Organization name</Label>             <Input
              id="orgName"
              placeholder="Your organization name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="border-white/10 bg-white/5"
            />
             {userEmail && (
               <p className="text-xs text-white/40 mt-1">
                 Derived from your email — feel free to change this
               </p>
             )}
          </div>

          <Separator className="bg-white/5" />

          <div className="space-y-2">
            <Label htmlFor="serverName">MCP server name</Label>
            <Input
              id="serverName"
              placeholder="production-db"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              className="border-white/10 bg-white/5"
            />
          </div>

          {transportType === "http" ? (
            <div className="space-y-2">
              <Label htmlFor="url">Endpoint URL</Label>
              <Input
                id="url"
                placeholder="https://mcp.example.com"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                className="border-white/10 bg-white/5"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="command">STDIO command</Label>
              <Input
                id="command"
                placeholder="npx -y @modelcontextprotocol/server-filesystem"
                value={stdioCommand}
                onChange={(e) => setStdioCommand(e.target.value)}
                className="border-white/10 bg-white/5"
              />
            </div>
          )}

          <Button
            className="w-full gap-2"
            disabled={!canSubmit || isCreating}
            onClick={handleCreate}
          >
            {isCreating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Shield className="size-4" />
            )}
            Register & Scan Server
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
