"use client";

import { useState } from "react";
import { Crown, FileText, Lock, Loader2, Wrench } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

interface ComplianceGateOverlayProps {
  currentPlan: string;
  variant: "pdf" | "remediation";
}

/**
 * Shows an upgrade prompt for gated compliance features:
 * - "pdf" variant: locks PDF report download/generation
 * - "remediation" variant: locks remediation guidance panel
 */
export function ComplianceGateOverlay({ currentPlan, variant }: ComplianceGateOverlayProps) {
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

  if (variant === "pdf") {
    return (
      <div className="rounded-lg border border-monitor/20 bg-monitor/5 p-4 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 text-sm text-slate-300">
          <Lock className="size-3.5 text-monitor" />
          <span>PDF Reports — Developer Plan</span>
        </div>
        <p className="text-xs text-slate-500">
          Download audit-ready compliance reports as PDF. Includes NSA CSI, OWASP MCP Top 10, and custom mapping.
        </p>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 w-full"
          disabled={loading}
          onClick={handleUpgrade}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Crown className="size-3.5" />}
          Upgrade to Unlock
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Blurred fake remediation items */}
      <div className="pointer-events-none select-none blur-[2px] opacity-30" aria-hidden="true">
        <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
          <p className="text-sm font-medium text-slate-200">Parameter validation</p>
          <p className="text-xs text-slate-500">Maintain current InboundScanner configuration</p>
        </div>
        <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2 mt-2">
          <p className="text-sm font-medium text-slate-200">Token enforcement</p>
          <p className="text-xs text-slate-500">Review permission sets for least-privilege</p>
        </div>
      </div>

      {/* Upgrade prompt */}
      <div className="rounded-lg border border-monitor/20 bg-monitor/5 p-4 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-sm text-slate-300">
          <Wrench className="size-3.5 text-monitor" />
          <span>Remediation Guidance</span>
        </div>
        <p className="text-xs text-slate-500">
          Get actionable fix steps for each failed control with links to documentation.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="border-monitor/30 text-monitor gap-1.5"
          disabled={loading}
          onClick={handleUpgrade}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />}
          Unlock with Developer Plan
        </Button>
      </div>
    </div>
  );
}
