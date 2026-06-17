"use client";

import { useState } from "react";
import { Calendar, Crown, Eye, Lock, Loader2, Shield, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { hasFeature } from "@/lib/feature-gates";
import { cn } from "@/lib/utils";

interface ServerProFeaturesProps {
  currentPlan: string;
  serverId: string;
}

/**
 * Displays advanced server protection features with appropriate gating:
 * - Block Mode (Developer+)
 * - Rug Pull Detection (Developer+)
 * - Custom Scan Schedule (Startup+)
 * - Policy Engine rules (Startup+)
 */
export function ServerProFeatures({ currentPlan, serverId }: ServerProFeaturesProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const hasBlockMode = hasFeature(currentPlan, "block_mode");
  const hasRugPull = hasFeature(currentPlan, "rug_pull_detection");
  const hasSchedule = hasFeature(currentPlan, "custom_scan_schedule");
  const hasPolicy = hasFeature(currentPlan, "policy_engine");

  const handleUpgrade = async (plan: string) => {
    setLoading(plan);
    try {
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing: "monthly" }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
        <Sparkles className="size-4 text-monitor" />
        Protection Settings
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Block Mode */}
        <Card className={cn("border-white/10 bg-[hsl(222,47%,6%)]", !hasBlockMode && "opacity-75")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400 flex items-center gap-2">
              <Shield className="size-3.5 text-secure" />
              Block Mode
              {!hasBlockMode && (
                <Badge variant="outline" className="ml-auto text-[9px] border-monitor/30 text-monitor">
                  Developer+
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">
              Automatically block tool calls that match known threat patterns. Prevents malicious operations
              before they execute.
            </p>
            {hasBlockMode ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">Enable block mode</span>
                <Switch defaultChecked />
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-monitor/30 text-monitor text-xs gap-1.5"
                disabled={loading === "developer"}
                onClick={() => handleUpgrade("developer")}
              >
                {loading === "developer" ? <Loader2 className="size-3 animate-spin" /> : <Lock className="size-3" />}
                Unlock — $29/mo
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Rug Pull Detection */}
        <Card className={cn("border-white/10 bg-[hsl(222,47%,6%)]", !hasRugPull && "opacity-75")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400 flex items-center gap-2">
              <ShieldAlert className="size-3.5 text-threat" />
              Rug Pull Detection
              {!hasRugPull && (
                <Badge variant="outline" className="ml-auto text-[9px] border-monitor/30 text-monitor">
                  Developer+
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">
              Detect when an MCP server changes its tool definitions mid-session (tool poisoning).
              Automatically terminates compromised sessions.
            </p>
            {hasRugPull ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">Enable rug pull detection</span>
                <Switch defaultChecked />
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-monitor/30 text-monitor text-xs gap-1.5"
                disabled={loading === "developer"}
                onClick={() => handleUpgrade("developer")}
              >
                {loading === "developer" ? <Loader2 className="size-3 animate-spin" /> : <Lock className="size-3" />}
                Unlock — $29/mo
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Custom Scan Schedule */}
        <Card className={cn("border-white/10 bg-[hsl(222,47%,6%)]", !hasSchedule && "opacity-75")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400 flex items-center gap-2">
              <Calendar className="size-3.5 text-blue-400" />
              Custom Scan Schedule
              {!hasSchedule && (
                <Badge variant="outline" className="ml-auto text-[9px] border-blue-500/30 text-blue-400">
                  Startup+
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">
              Schedule automated security scans at custom intervals. Configure daily, weekly, or cron-based
              scanning with notification preferences.
            </p>
            {hasSchedule ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Schedule</span>
                  <span className="font-mono text-slate-400">Every 6 hours</span>
                </div>
                <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 text-xs">
                  Configure Schedule
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-blue-500/30 text-blue-400 text-xs gap-1.5"
                disabled={loading === "startup"}
                onClick={() => handleUpgrade("startup")}
              >
                {loading === "startup" ? <Loader2 className="size-3 animate-spin" /> : <Lock className="size-3" />}
                Unlock — $299/mo
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Policy Engine */}
        <Card className={cn("border-white/10 bg-[hsl(222,47%,6%)]", !hasPolicy && "opacity-75")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400 flex items-center gap-2">
              <Eye className="size-3.5 text-purple-400" />
              Policy Engine
              {!hasPolicy && (
                <Badge variant="outline" className="ml-auto text-[9px] border-purple-500/30 text-purple-400">
                  Startup+
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">
              Define custom allow/deny rules per tool name, argument pattern, or calling agent.
              Fine-grained access control beyond basic block mode.
            </p>
            {hasPolicy ? (
              <Button size="sm" variant="outline" className="border-purple-500/30 text-purple-400 text-xs">
                Manage Policies
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-purple-500/30 text-purple-400 text-xs gap-1.5"
                disabled={loading === "startup"}
                onClick={() => handleUpgrade("startup")}
              >
                {loading === "startup" ? <Loader2 className="size-3 animate-spin" /> : <Lock className="size-3" />}
                Unlock — $299/mo
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
