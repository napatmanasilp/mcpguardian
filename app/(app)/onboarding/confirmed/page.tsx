"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronRight, Shield, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OnboardingSteps } from "@/components/onboarding/onboarding-steps";
import { ShieldLogo } from "@/components/auth/shield-logo";

export default function ConfirmedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const proxyConnected = searchParams.get("proxy") === "connected";

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg border-white/10" style={{ background: "var(--bg-surface)" }}>
        <CardHeader className="text-center">
          <OnboardingSteps currentStep={3} />
          <div className="mx-auto mb-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/20 mx-auto">
              <Shield className="size-8 text-emerald-400" />
            </div>
          </div>
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

          {/* Contextual message */}
          <p className="text-sm text-white/40 text-center">
            {proxyConnected
              ? "You're all set. Your first MCP server is registered, scanned, and proxied."
              : "Your server was scanned. Connect the proxy to enable full runtime protection."}
          </p>

          {/* CTAs */}
          <div className="flex gap-3">
            {!proxyConnected && (
              <Button
                variant="outline"
                className="flex-1 border-white/10"
                onClick={() => router.push("/onboarding/proxy-setup")}
              >
                Complete Proxy Setup →
              </Button>
            )}
            <Button
              className={proxyConnected ? "w-full gap-2" : "flex-1 gap-2"}
              onClick={() => router.push("/dashboard")}
            >
              {proxyConnected ? "Explore Dashboard" : "Go to Dashboard"}{" "}
              <ChevronRight className="size-4" />
            </Button>
          </div>
          {!proxyConnected && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => router.push("/onboarding/confirmed?proxy=connected")}
                className="text-xs text-white/30 hover:text-white/50 transition-colors"
              >
                I'll set this up later
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
