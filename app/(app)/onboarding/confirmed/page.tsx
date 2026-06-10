"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronRight, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldLogo } from "@/components/auth/shield-logo";

export default function ConfirmedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const skipped = searchParams.get("skipped") === "true";

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/20 mx-auto">
              <Shield className="size-8 text-emerald-400" />
            </div>
          </div>
          <CardTitle className="text-xl">
            MCPGuardian is now protecting your agent
          </CardTitle>
          <CardDescription>
            Your servers are being scanned and monitored for security threats.
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
                <p className="text-xs text-slate-400">
                  All servers are scanned before connection
                </p>
              </div>
            </div>
            <div className={`flex items-center gap-3 rounded-lg p-4 border ${skipped ? "border-amber-500/20 bg-amber-500/10" : "border-emerald-500/20 bg-emerald-500/10"}`}>
              <div className={`flex size-8 items-center justify-center rounded-full ${skipped ? "bg-amber-500/20" : "bg-emerald-500/20"}`}>
                {skipped ? (
                  <span className="text-amber-400 text-sm font-bold">!</span>
                ) : (
                  <Check className="size-4 text-emerald-400" />
                )}
              </div>
              <div>
                <p className={`text-sm font-semibold ${skipped ? "text-amber-300" : "text-emerald-300"}`}>
                  Runtime proxy protection
                </p>
                <p className="text-xs text-slate-400">
                  {skipped ? "Not yet connected — set up from the dashboard" : "Active and monitoring tool calls"}
                </p>
              </div>
            </div>
          </div>

          <Button
            className="w-full gap-2"
            onClick={() => router.push("/dashboard")}
          >
            Go to dashboard <ChevronRight className="size-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
