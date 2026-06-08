"use client";

import { AlertTriangle, CheckCircle2, Lightbulb, Server, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { gradeColors, type SecurityGrade } from "@/lib/security-grade";
import { cn } from "@/lib/utils";
import type { ScanResult } from "@/lib/scanner/types";

interface ScanResultsProps {
  result: ScanResult;
}

const severityBadgeVariant = (severity: string) => {
  switch (severity) {
    case "CRITICAL":
      return "destructive" as const;
    case "HIGH":
      return "default" as const;
    case "MEDIUM":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
};

const severityBadgeClass = (severity: string) => {
  switch (severity) {
    case "HIGH":
      return "bg-orange-500 text-white hover:bg-orange-500/80 border-orange-500";
    case "MEDIUM":
      return "bg-yellow-500 text-white hover:bg-yellow-500/80 border-yellow-500";
    case "LOW":
      return "bg-blue-500 text-white hover:bg-blue-500/80 border-blue-500";
    default:
      return "";
  }
};

export const ScanResults = ({ result }: ScanResultsProps) => {
  const colors = gradeColors[result.grade as SecurityGrade] || gradeColors.F;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <div
          className={cn(
            "flex size-32 shrink-0 items-center justify-center rounded-full font-bold text-5xl text-white",
            result.grade === "A" && "bg-green-500",
            result.grade === "B" && "bg-blue-500",
            result.grade === "C" && "bg-yellow-500",
            result.grade === "D" && "bg-orange-500",
            result.grade === "F" && "bg-red-500",
          )}
        >
          {result.grade}
        </div>
        <div>
          <p className="text-3xl font-bold">Score: {result.score}/100</p>
          <p className="text-muted-foreground">
            Scanned {result.serversScanned} server{result.serversScanned !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Server className="size-4" />
              Servers Scanned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{result.serversScanned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Shield className="size-4" />
              Critical Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-2xl font-bold", result.criticalIssues > 0 && "text-red-500")}>
              {result.criticalIssues}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="size-4" />
              High Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-2xl font-bold", result.highIssues > 0 && "text-orange-500")}>
              {result.highIssues}
            </p>
          </CardContent>
        </Card>
      </div>

      {result.servers.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          {result.servers.map((server) => (
            <AccordionItem key={server.name} value={server.name}>
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{server.name}</span>
                  <Badge
                    variant={server.grade === "A" || server.grade === "B" ? "default" : "destructive"}
                  >
                    {server.grade}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {server.issues.length === 0 ? (
                  <div className="flex items-center gap-2 py-2 text-muted-foreground">
                    <CheckCircle2 className="size-4 text-green-500" />
                    <span>No issues found</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {server.issues.map((issue, idx) => (
                      <div key={idx} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <Badge
                            variant={severityBadgeVariant(issue.severity)}
                            className={cn(
                              "shrink-0",
                              severityBadgeClass(issue.severity),
                            )}
                          >
                            {issue.severity}
                          </Badge>
                          <div className="min-w-0">
                            <p className="font-semibold">{issue.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {issue.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                          <Lightbulb className="mt-0.5 size-4 shrink-0 text-yellow-500" />
                          <span className="text-muted-foreground">{issue.fix}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};