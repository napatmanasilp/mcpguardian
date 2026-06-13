"use client";

import { CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { OwaspMcpControl } from "@/lib/compliance-mappings";

interface NsaControl {
  id: string;
  label: string;
  description: string;
  passed: boolean;
  defaultStatus: "passed" | "roadmap";
  deliveryDate?: string;
}

interface FrameworkTabsProps {
  nsaControls: NsaControl[];
  owaspControls: OwaspMcpControl[];
}

export function FrameworkTabs({ nsaControls, owaspControls }: FrameworkTabsProps) {
  // Filter out roadmap controls from NSA active list (they are shown separately)
  const activeNsaControls = nsaControls.filter((c) => c.defaultStatus !== "roadmap");

  return (
    <Tabs defaultValue="nsa" className="w-full">
      <TabsList className="bg-white/5 border border-white/10">
        <TabsTrigger value="nsa" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
          NSA MCP CSI
        </TabsTrigger>
        <TabsTrigger value="owasp" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
          OWASP MCP Top 10
        </TabsTrigger>
      </TabsList>

      <TabsContent value="nsa">
        <Card className="border-white/10 bg-bg-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">NSA Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeNsaControls.map((control) => (
              <div key={control.id} className="flex items-center gap-3 rounded-md bg-white/5 px-3 py-2">
                {control.passed ? (
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                ) : (
                  <span className="size-4 flex items-center justify-center text-amber-400 shrink-0 text-xs">○</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-300">{control.label}</p>
                  <p className="text-[10px] text-slate-500">{control.description}</p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] shrink-0",
                    control.passed ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400",
                  )}
                >
                  {control.passed ? "Active" : "Pending"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="owasp">
        <Card className="border-white/10 bg-bg-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">OWASP MCP Top 10</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {owaspControls.map((control) => (
              <div key={control.id} className="flex items-center gap-3 rounded-md bg-white/5 px-3 py-2">
                {control.passed ? (
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                ) : (
                  <span className="size-4 flex items-center justify-center text-red-400 shrink-0 text-xs">✕</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-300">{control.label}</p>
                  <p className="text-[10px] text-slate-500">{control.description}</p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] shrink-0",
                    control.passed ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400",
                  )}
                >
                  {control.passed ? "Pass" : "Fail"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
