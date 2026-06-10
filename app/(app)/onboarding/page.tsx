"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Loader2, Shield } from "lucide-react";

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
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldLogo } from "@/components/auth/shield-logo";

const PIPELINE_STEPS = [
  "Static config analysis",
  "Domain verification",
  "Sandbox execution",
  "Hash comparison",
];

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
  }>({});

  const canSubmit = orgName.trim() && serverName.trim() && (transportType === "http" ? endpointUrl.trim() : stdioCommand.trim());

  const handleCreate = useCallback(async () => {
    if (!canSubmit) return;
    setIsCreating(true);
    setStep("scanning");

    try {
      // Call the onboarding API route (uses service role, bypasses RLS)
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
        throw new Error(
          responseData?.error?.message ?? "Failed to create organization",
        );
      }

      const { scanId } = responseData.data ?? {};

      if (!scanId) {
        // No scan was triggered (non-critical), go straight to complete
        setStep("complete");
        return;
      }

      setScanId(scanId);

      // 3. Poll scan progress
      const pollInterval = setInterval(async () => {
        try {
          const scanRes = await fetch(`/api/scans/${scanId}`);
          if (!scanRes.ok) return;
          const data = await scanRes.json();
          const scan = data.data;

          if (scan?.status === "completed" || scan?.status === "failed") {
            clearInterval(pollInterval);
            const steps = (scan.pipeline_steps ?? []) as Array<{ step_name: string; status: string }>;
            setCompletedSteps(steps.map((s) => s.step_name));
            setScanResult({
              status: scan.status,
              risk_score: scan.risk_score,
              overall_result: scan.overall_result,
            });
            setStep("complete");
          } else if (scan?.pipeline_steps) {
            const activeSteps = (scan.pipeline_steps as Array<{ step_name: string; status: string }>)
              .filter((s) => s.status === "PASS" || s.status === "FAIL")
              .map((s) => s.step_name);
            setCompletedSteps(activeSteps);
          }
        } catch {
          // poll continues
        }
      }, 2000);

      // Cleanup on unmount after 60s
      setTimeout(() => clearInterval(pollInterval), 60000);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "An error occurred");
      setStep("form");
    } finally {
      setIsCreating(false);
    }
  }, [canSubmit, orgName, serverName, transportType, endpointUrl, stdioCommand]);

  if (step === "scanning" || step === "complete") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-lg border-white/10 bg-[hsl(222,47%,6%)]">
          <CardHeader className="text-center">
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
              const stepKey = name.toLowerCase().replace(/\s+/g, "_");
              const isActive = step === "scanning" && !done && completedSteps.length >= PIPELINE_STEPS.indexOf(name);
              return (
                <div key={name} className="flex items-center gap-3 text-sm">
                  {done ? (
                    <div className="flex size-6 items-center justify-center rounded-full bg-emerald-500/20">
                      <Check className="size-3.5 text-emerald-400" />
                    </div>
                  ) : isActive ? (
                    <Loader2 className="size-5 animate-spin text-blue-400" />
                  ) : (
                    <div className="size-6 rounded-full border border-slate-600" />
                  )}
                  <span className={done ? "text-slate-200" : "text-slate-500"}>{name}</span>
                </div>
              );
            })}

            {scanError && (
              <p className="text-sm text-red-400 text-center">{scanError}</p>
            )}

            <Separator className="bg-white/5" />

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-white/10"
                onClick={() => router.push("/onboarding/proxy-setup")}
              >
                Continue to proxy setup
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <ShieldLogo className="size-12" />
          </div>
          <CardTitle className="text-xl">Set up your organization</CardTitle>
          <CardDescription>
            Create your organization and register your first MCP server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Transport type warnings */}
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
            <Label htmlFor="orgName">Organization name</Label>
            <Input
              id="orgName"
              placeholder="Acme Corp"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="border-white/10 bg-white/5"
            />
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

          <div className="space-y-2">
            <Label>Transport type</Label>
            <Select value={transportType} onValueChange={(v) => setTransportType(v as "http" | "stdio")}>
              <SelectTrigger className="border-white/10 bg-white/5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="http">HTTP (recommended)</SelectItem>
                <SelectItem value="stdio">STDIO</SelectItem>
              </SelectContent>
            </Select>
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
