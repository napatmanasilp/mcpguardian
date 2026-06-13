"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DynamicErrorBoundary } from "@/components/ui/dynamic-error-boundary";
import { Textarea } from "@/components/ui/textarea";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import type { ScanResult } from "@/lib/scanner/types";

// Code-split: ScanResults is a very large client component (500+ lines).
// Requirement 20.1: code-split client components > 50 KB not needed on initial render
const ScanResults = dynamic(
  () => import("@/components/scan-results").then((mod) => mod.ScanResults),
  {
    ssr: false,
    loading: () => (
      <PageSkeleton blocks={[{ type: "chart", height: "16rem" }, { type: "table", height: "12rem" }]} />
    ),
  },
);

const SAMPLE_CONFIG = `{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/dev/projects"]
    }
  }
}`;

interface ScanConfigFormProps {
  isAuthenticated: boolean;
}

export const ScanConfigForm = ({ isAuthenticated }: ScanConfigFormProps) => {
  const [config, setConfig] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    setJsonError(null);

    try {
      JSON.parse(config);
    } catch {
      setJsonError("Invalid JSON format. Please check your configuration.");
      return;
    }

    setScanning(true);
    setResult(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          toast.error("Rate limit exceeded. Please try again in a minute.");
          return;
        }
        toast.error(data.error || "Scan failed. Please try again.");
        return;
      }

      setResult(data as ScanResult);
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setScanning(false);
    }
  }, [config]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Textarea
        value={config}
        onChange={(e) => {
          setConfig(e.target.value);
          setJsonError(null);
        }}
        placeholder={SAMPLE_CONFIG}
        rows={10}
        className="min-h-[220px] resize-y font-mono text-sm leading-relaxed"
        spellCheck={false}
      />

      {jsonError && (
        <p className="text-sm text-red-500">{jsonError}</p>
      )}

      <Button
        type="button"
        size="lg"
        className="h-12 w-full text-base"
        disabled={!config.trim() || scanning}
        onClick={handleScan}
      >
        {scanning ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Scanning...
          </>
        ) : (
          <>
            <ScanSearch className="size-5" aria-hidden />
            Scan Now
          </>
        )}
      </Button>

      {result && (
        <>
          <DynamicErrorBoundary componentName="Scan Results">
            <ScanResults result={result} />
          </DynamicErrorBoundary>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
              <p className="text-lg font-medium">
                Sign up to save your results and enable continuous monitoring
              </p>
              <div className="flex gap-3">
                <Button asChild>
                  <Link href="/signup">Sign Up Free</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/pricing">View Pricing</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!result && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-5 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="text-sm font-medium">Sample security grade</p>
            <p className="text-xs text-muted-foreground">
              Paste your config above to scan for real results
            </p>
          </div>
          <div className="flex size-20 items-center justify-center rounded-full bg-yellow-500/15 font-bold text-3xl text-yellow-600 ring-2 ring-yellow-500/30 dark:text-yellow-400">
            B
          </div>
        </div>
      )}
    </div>
  );
};