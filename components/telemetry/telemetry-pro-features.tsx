"use client";

import { useState } from "react";
import { BarChart3, Crown, GitCompare, Lock, Loader2, Radio, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasFeature } from "@/lib/feature-gates";
import { cn } from "@/lib/utils";

interface TelemetryProFeaturesProps {
  currentPlan: string;
}

/**
 * Shows advanced telemetry features with appropriate gating:
 * - Cross-Server Analysis (Team+)
 * - OpenTelemetry Export (Enterprise)
 * - Custom Dashboards (Team+)
 */
export function TelemetryProFeatures({ currentPlan }: TelemetryProFeaturesProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const hasCrossServer = hasFeature(currentPlan, "cross_server_analysis");
  const hasOtel = hasFeature(currentPlan, "otel_export");

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

  // If user has all features, show the active pro panels
  if (hasCrossServer && hasOtel) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Sparkles className="size-4 text-monitor" />
          Advanced Analytics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-400 flex items-center gap-2">
                <GitCompare className="size-3.5 text-monitor" />
                Cross-Server Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500">
                Compare latency, error rates, and threat patterns across all registered MCP servers.
                Correlate tool call anomalies with inter-server dependencies.
              </p>
              <Button size="sm" variant="outline" className="mt-3 border-monitor/30 text-monitor text-xs">
                Open Analysis Dashboard
              </Button>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-400 flex items-center gap-2">
                <Radio className="size-3.5 text-blue-400" />
                OpenTelemetry Export
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500">
                Stream traces, metrics, and logs to Datadog, Grafana, or any OTLP-compatible backend.
                Full span context for every tool invocation.
              </p>
              <Button size="sm" variant="outline" className="mt-3 border-blue-500/30 text-blue-400 text-xs">
                Configure OTel Endpoint
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show gated feature cards
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
        <Sparkles className="size-4 text-monitor" />
        Advanced Analytics
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Cross-Server Analysis */}
        <Card className={cn(
          "border-white/10 bg-[hsl(222,47%,6%)] relative",
          !hasCrossServer && "opacity-80"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400 flex items-center gap-2">
              <GitCompare className="size-3.5 text-monitor" />
              Cross-Server Analysis
              {!hasCrossServer && (
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-monitor/10 text-monitor border border-monitor/20">
                  Team+
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">
              Compare latency, error rates, and threat patterns across all servers. Correlate anomalies with
              inter-server dependencies.
            </p>
            {hasCrossServer ? (
              <Button size="sm" variant="outline" className="border-monitor/30 text-monitor text-xs">
                Open Analysis
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-monitor/30 text-monitor text-xs gap-1.5"
                disabled={loading === "team"}
                onClick={() => handleUpgrade("team")}
              >
                {loading === "team" ? <Loader2 className="size-3 animate-spin" /> : <Lock className="size-3" />}
                Unlock — Team Plan
              </Button>
            )}
          </CardContent>
        </Card>

        {/* OpenTelemetry Export */}
        <Card className={cn(
          "border-white/10 bg-[hsl(222,47%,6%)] relative",
          !hasOtel && "opacity-80"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400 flex items-center gap-2">
              <Radio className="size-3.5 text-blue-400" />
              OpenTelemetry Export
              {!hasOtel && (
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Enterprise
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">
              Stream traces, metrics, and logs to Datadog, Grafana, or any OTLP-compatible backend with full
              span context.
            </p>
            {hasOtel ? (
              <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 text-xs">
                Configure Endpoint
              </Button>
            ) : (
              <Link href="/contact">
                <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 text-xs gap-1.5">
                  <Lock className="size-3" />
                  Contact Sales
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Custom Metric Alerts */}
        <Card className={cn(
          "border-white/10 bg-[hsl(222,47%,6%)] relative",
          !hasCrossServer && "opacity-80"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400 flex items-center gap-2">
              <BarChart3 className="size-3.5 text-caution" />
              Custom Metric Alerts
              {!hasCrossServer && (
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-caution/10 text-caution border border-caution/20">
                  Team+
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">
              Set thresholds on latency p99, error rates, or tool call volume. Alert via webhook when breached.
            </p>
            {hasCrossServer ? (
              <Button size="sm" variant="outline" className="border-caution/30 text-caution text-xs">
                Configure Thresholds
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-caution/30 text-caution text-xs gap-1.5"
                disabled={loading === "team"}
                onClick={() => handleUpgrade("team")}
              >
                {loading === "team" ? <Loader2 className="size-3 animate-spin" /> : <Lock className="size-3" />}
                Unlock — Team Plan
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
