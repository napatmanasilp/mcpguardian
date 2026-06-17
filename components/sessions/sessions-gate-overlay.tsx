"use client";

import { Activity, Crown, Lock, Loader2, Radar, Shield, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/feature-gates";

interface SessionsGateOverlayProps {
  currentPlan: string;
}

/**
 * Shows a blurred preview of fake session data plus an upgrade prompt
 * for users whose plan doesn't include proxy gateway access.
 */
export function SessionsGateOverlay({ currentPlan }: SessionsGateOverlayProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "developer", billing: "monthly" }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* Blurred preview of fake sessions */}
      <div className="pointer-events-none select-none blur-[3px] opacity-40" aria-hidden="true">
        {/* Fake filter bar */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-xs text-slate-500 font-mono">Filter:</span>
          {["All", "Active", "Clean exit", "Threat"].map((s) => (
            <span key={s} className="px-3 py-1.5 rounded-md text-xs font-mono font-medium text-slate-400 border border-transparent">
              {s}
            </span>
          ))}
        </div>

        {/* Fake session rows */}
        <div className="space-y-2">
          {[
            { name: "filesystem-server", status: "active", calls: 47, threats: 0 },
            { name: "postgres-mcp", status: "terminated_clean", calls: 128, threats: 0 },
            { name: "github-mcp-server", status: "terminated_threat", calls: 92, threats: 3 },
            { name: "web-scraper-mcp", status: "active", calls: 15, threats: 0 },
            { name: "slack-mcp-bridge", status: "terminated_rug_pull", calls: 64, threats: 1 },
          ].map((session) => {
            const isActive = session.status === "active";
            const isThreat = session.status === "terminated_threat" || session.status === "terminated_rug_pull";
            return (
              <div
                key={session.name}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-4 py-3",
                  isActive ? "border-secure/20 bg-secure/5" :
                  isThreat ? "border-threat/20 bg-threat/5" :
                  "border-white/10 bg-white/5",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "size-8 rounded-full flex items-center justify-center",
                    isActive ? "bg-secure/20" : isThreat ? "bg-threat/20" : "bg-slate-500/15",
                  )}>
                    {isActive ? <Shield className="size-4 text-secure" /> :
                     isThreat ? <ShieldAlert className="size-4 text-threat" /> :
                     <Activity className="size-4 text-slate-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{session.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{session.calls} calls</span>
                      {session.threats > 0 && (
                        <span className="text-xs text-threat">{session.threats} threats</span>
                      )}
                    </div>
                  </div>
                </div>
                <Badge
                  className={cn(
                    "text-[10px]",
                    isActive && "bg-secure/20 text-secure border-secure/30",
                    session.status === "terminated_clean" && "bg-slate-500/20 text-slate-400 border-slate-500/30",
                    isThreat && "bg-threat/20 text-threat border-threat/30",
                  )}
                  variant="outline"
                >
                  {isActive ? "active" : isThreat ? "threat" : "clean"}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fade gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[hsl(222,47%,8%)] pointer-events-none" />

      {/* Upgrade prompt */}
      <div className="absolute inset-x-0 bottom-0 top-1/4 flex flex-col items-center justify-center text-center gap-4 p-6">
        <div className="size-12 rounded-full bg-monitor/15 flex items-center justify-center">
          <Lock className="size-6 text-monitor" />
        </div>
        <div className="space-y-2 max-w-md">
          <h3 className="text-base font-semibold text-slate-200 flex items-center justify-center gap-2">
            <Sparkles className="size-4 text-monitor" />
            Unlock Proxy Sessions &amp; Runtime Protection
          </h3>
          <p className="text-sm text-slate-400">
            Real-time session monitoring, rug pull detection, and tool call blocking require the Developer plan ($29/mo).
            See every agent connection, monitor threats live, and auto-terminate malicious sessions.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {["Session Watchdog", "Rug Pull Detection", "Block Mode", "Live Threat Feed"].map((f) => (
              <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-monitor/10 text-monitor border border-monitor/20">
                {f}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            disabled={loading}
            onClick={handleUpgrade}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Crown className="size-4" />}
            Upgrade to Developer — $29/mo
          </Button>
          <Link href="/upgrade">
            <Button variant="outline" size="sm" className="border-white/10 text-slate-400">
              Compare Plans
            </Button>
          </Link>
        </div>
        <p className="text-[10px] text-slate-600">No lock-in · Cancel anytime · Annual billing saves ~17%</p>
      </div>
    </div>
  );
}
