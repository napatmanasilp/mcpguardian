"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";

import { ScanBlockedModal } from "@/components/billing/scan-blocked-modal";
import { Button } from "@/components/ui/button";
import { DynamicErrorBoundary } from "@/components/ui/dynamic-error-boundary";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { canScan, useUsage } from "@/lib/usage";
import { cn } from "@/lib/utils";
import type { ScanResult } from "@/lib/scanner/types";

// Code-split: ScanResults is a very large client component (500+ lines with sub-components).
// Only rendered after a scan completes, not needed on initial page load.
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

// ─── Preset Configurations ─────────────────────────────────────────────

const PRESETS = {
  vulnerable: JSON.stringify(
    {
      mcpServers: {
        "poisoned-server": {
          url: "http://example.com/mcp",
        },
        "supply-chain-risk": {
          command: "npx",
          args: ["mcp-remote@0.0.5"],
        },
      },
    },
    null,
    2,
  ),
  clean: JSON.stringify(
    {
      mcpServers: {
        "secure-server": {
          url: "https://secure.example.com/mcp",
        },
      },
    },
    null,
    2,
  ),
  multiserver: JSON.stringify(
    {
      mcpServers: {
        "server-alpha": { url: "https://alpha.example.com/mcp" },
        "server-beta": { url: "https://beta.example.com/mcp" },
        "server-gamma": { command: "node", args: ["./server.js"] },
      },
    },
    null,
    2,
  ),
} as const;

const PLACEHOLDER_CONFIG = `{
  "mcpServers": {
    "example-server": {
      "command": "npx",
      "args": ["-y", "example-mcp-server"],
      "env": {
        "API_KEY": "\${YOUR_API_KEY}"
      }
    }
  }
}`;

const SCAN_STEPS = [
  "Connecting to servers...",
  "Running poisoning checks...",
  "Cross-referencing CVEs...",
  "Analyzing cross-server risks...",
  "Computing security score...",
];

// Count issue types from the scanner (static snapshot for the header subtitle)
const ISSUE_TYPE_COUNT = 36;

// ─── Helpers ───────────────────────────────────────────────────────────

function parseServerCount(json: string): number {
  try {
    const parsed = JSON.parse(json);
    const servers = parsed?.mcpServers;
    if (!servers || typeof servers !== "object") return 0;
    return Object.keys(servers).length;
  } catch {
    return 0;
  }
}

function getValidationState(
  json: string,
): { valid: true; servers: number } | { valid: false; error: string } | null {
  if (!json.trim()) return null;
  try {
    const parsed = JSON.parse(json);
    const servers = parsed?.mcpServers;
    if (!servers || typeof servers !== "object") {
      return { valid: false, error: "Configuration must include an 'mcpServers' object" };
    }
    return { valid: true, servers: Object.keys(servers).length };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

// ─── Component ─────────────────────────────────────────────────────────

const ScanPage = () => {
  const [config, setConfig] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [scanBlockedOpen, setScanBlockedOpen] = useState(false);
  const [deepScan, setDeepScan] = useState(false);
  const [semanticAnalysis, setSemanticAnalysis] = useState(false);
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const { usage: usageData } = useUsage();

  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Real-time JSON validation with debounce
  const [debouncedConfig, setDebouncedConfig] = useState(config);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedConfig(config);
    }, 300);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [config]);

  const validation = getValidationState(debouncedConfig);
  const serverCount = validation?.valid === true ? validation.servers : 0;
  const isValid = config.trim().length > 0;

  // Scan step cycling
  useEffect(() => {
    if (scanning) {
      setScanStepIndex(0);
      stepIntervalRef.current = setInterval(() => {
        setScanStepIndex((prev) => (prev + 1) % SCAN_STEPS.length);
      }, 800);
    } else {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
    }
    return () => {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
    };
  }, [scanning]);

  // Show animation when result arrives
  useEffect(() => {
    if (result) {
      // Small delay to trigger fade-in after render
      requestAnimationFrame(() => setShowResults(true));
    } else {
      setShowResults(false);
    }
  }, [result]);

  const handleScan = useCallback(async () => {
    setJsonError(null);
    setUpgradeRequired(false);

    const v = getValidationState(config);
    if (!v || !v.valid) {
      setJsonError(v?.error ?? "Invalid JSON format.");
      return;
    }

    // Check if user can scan (enforce plan limits)
    if (usageData && !canScan(usageData)) {
      setScanBlockedOpen(true);
      return;
    }

    setScanning(true);
    setResult(null);
    setScanId(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config,
          enableDeepScan: deepScan,
          enableSemanticAnalysis: semanticAnalysis,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          toast.error("Rate limit exceeded. Please try again in a minute.");
          return;
        }
        if (res.status === 403 && data.upgrade) {
          setUpgradeRequired(true);
          return;
        }
        toast.error(data.error || "Scan failed. Please try again.");
        return;
      }

      // data might include an id if the scan was saved
      const { id: scanIdFromResponse, ...scanResult } = data;
      setResult(scanResult as ScanResult);
      if (scanIdFromResponse) setScanId(scanIdFromResponse);
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setScanning(false);
    }
  }, [config, deepScan, semanticAnalysis]);

  const loadPreset = useCallback((key: keyof typeof PRESETS) => {
    setConfig(PRESETS[key]);
    setJsonError(null);
    setUpgradeRequired(false);
    setResult(null);
  }, []);

  const handleScanAnother = useCallback(() => {
    setConfig("");
    setResult(null);
    setScanId(null);
    setJsonError(null);
    setUpgradeRequired(false);
    setShowResults(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Security Scan</h1>
          <p className="text-sm text-slate-400 mt-1">
            Paste your MCP configuration JSON to analyze {ISSUE_TYPE_COUNT} issue types across
            your configured servers
          </p>
        </div>
        {serverCount > 0 && (
          <div className="shrink-0 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 text-sm font-mono">
            {serverCount} server{serverCount > 1 ? "s" : ""} detected
          </div>
        )}
      </div>

      {/* ── Input Section ────────────────────────────────────────────── */}
      <div className="max-w-3xl space-y-4">
        {/* Preset configs row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Try example:</span>
          <button
            onClick={() => loadPreset("vulnerable")}
            className="px-2.5 py-1 rounded text-xs border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-mono"
          >
            ⚠ Vulnerable Config
          </button>
          <button
            onClick={() => loadPreset("clean")}
            className="px-2.5 py-1 rounded text-xs border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors font-mono"
          >
            ✓ Clean Config
          </button>
          <button
            onClick={() => loadPreset("multiserver")}
            className="px-2.5 py-1 rounded text-xs border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors font-mono"
          >
            ⟷ Multi-Server
          </button>
        </div>

        {/* Textarea with validation indicator */}
        <div className="relative">
          <Textarea
            value={config}
            onChange={(e) => {
              setConfig(e.target.value);
              setJsonError(null);
            }}
            placeholder={PLACEHOLDER_CONFIG}
            rows={12}
            className={cn(
              "font-mono text-sm bg-[hsl(222,47%,6%)] border-white/10 focus:border-blue-500/50 text-slate-200 placeholder:text-slate-600 resize-y min-h-[220px] leading-relaxed",
              validation?.valid === true && "ring-1 ring-emerald-500/50",
              validation?.valid === false && "ring-1 ring-red-500/50 border-red-500/30",
            )}
            spellCheck={false}
          />
          {/* Valid JSON badge */}
          {validation?.valid === true && (
            <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              ✓ Valid JSON
            </span>
          )}
        </div>

        {/* Character count + server count */}
        <div className="flex justify-between text-[11px] text-slate-500 font-mono -mt-1">
          <span>{config.length} chars</span>
          <span>
            {serverCount} server{serverCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* JSON error */}
        {validation?.valid === false && !jsonError && (
          <p className="text-xs text-red-400 font-mono leading-relaxed">
            {validation.error}
          </p>
        )}
        {jsonError && <p className="text-sm text-red-500">{jsonError}</p>}

        {/* Scan options row */}
        <div className="flex flex-wrap items-center gap-4 py-3 border-t border-white/10">
          <span className="text-xs text-slate-500">Options:</span>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Switch checked={deepScan} onCheckedChange={setDeepScan} className="scale-90" />
            <span className="text-xs text-slate-300">Deep Scan</span>
            <span className="text-[10px] text-slate-500">(prompts + resources + SBOM, +~2s)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Switch
              checked={semanticAnalysis}
              onCheckedChange={setSemanticAnalysis}
              className="scale-90"
            />
            <span className="text-xs text-slate-300">AI Semantic Analysis</span>
            <span className="text-[10px] text-slate-500">(LLM-powered, +~5s)</span>
          </label>
        </div>

        {/* Scan button */}
        <Button
          type="button"
          size="lg"
          className="h-12 w-full text-base"
          disabled={!serverCount || scanning}
          onClick={handleScan}
        >
          {scanning ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden />
              {SCAN_STEPS[scanStepIndex]}
            </>
          ) : (
            <>
              <ScanSearch className="size-5" aria-hidden />
              Scan Now
            </>
          )}
        </Button>
      </div>

      {/* ── Upgrade Required Alert ────────────────────────────────────── */}
      {upgradeRequired && (
        <Alert variant="destructive" className="max-w-3xl">
          <AlertTitle>Check Limit Reached</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p>You&apos;ve used all available checks for this month.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setScanBlockedOpen(true)}>
                View Options
              </Button>
              <Button asChild>
                <Link href="/billing/upgrade">Upgrade Plan</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Scan Blocked Modal ───────────────────────────────────────── */}
      {usageData && (
        <ScanBlockedModal
          open={scanBlockedOpen}
          onOpenChange={setScanBlockedOpen}
          plan={usageData.plan}
          checksUsed={usageData.checksUsed}
          checksIncluded={usageData.checksIncluded}
          checksPurchased={usageData.checksPurchased}
          resetDate={usageData.resetDate}
          unscannedServers={serverCount}
        />
      )}

      {/* ── Results ──────────────────────────────────────────────────── */}
      {result && (          <div
            className={cn(
              "max-w-4xl space-y-6 transition-all duration-500",
              showResults ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
            )}
          >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-200">Scan Results</h2>
            {scanId && (
              <Link
                href={`/reports/${scanId}`}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                View full report &rarr;
              </Link>
            )}
          </div>
          <DynamicErrorBoundary componentName="Scan Results">
            <ScanResults result={result} config={config} onReset={handleScanAnother} />
          </DynamicErrorBoundary>
        </div>
      )}
    </main>
  );
};

export default ScanPage;
