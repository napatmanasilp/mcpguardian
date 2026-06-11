"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function WelcomeCard({ proxyConnected }: { proxyConnected: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("mcpg-welcome-dismissed");
    if (stored === "true") {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("mcpg-welcome-dismissed", "true");
  };

  if (dismissed) return null;

  if (!proxyConnected) {
    return (
      <div className="relative rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 flex items-start gap-4">
        <div className="size-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
          <AlertTriangle className="size-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white">Proxy not connected</p>
          <p className="text-sm text-white/50 mt-0.5">
            Runtime protection is inactive. Connect your proxy to intercept and monitor tool calls in real time.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/onboarding/proxy-setup">
            <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-black font-medium">
              Connect Proxy →
            </Button>
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            className="size-6 rounded-md flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 flex items-start gap-4">
      <div className="size-9 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
        <ShieldCheck className="size-4 text-emerald-400" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-white">MCPGuardian is active</p>
        <p className="text-sm text-white/50 mt-0.5">
          Your MCP server is being monitored. Tool calls will appear here as your agent starts working.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/servers">
          <Button size="sm" variant="outline" className="border-white/10">
            View Server →
          </Button>
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          className="size-6 rounded-md flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
