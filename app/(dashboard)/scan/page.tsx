"use client";

import { useCallback, useState } from "react";
import { Copy, Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScanResults } from "@/components/scan-results";
import type { ScanResult } from "@/lib/scanner/types";

const PLACEHOLDER_CONFIG = `{
  "mcpServers": {
    "example-server": {
      "command": "npx",
      "args": ["-y", "example-mcp-server"],
      "env": {
        "API_KEY": "${"${YOUR_API_KEY}"}"
      }
    }
  }
}`;

const ScanPage = () => {
  const [config, setConfig] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  const handleScan = useCallback(async () => {
    setJsonError(null);
    setUpgradeRequired(false);

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
        if (res.status === 403 && data.upgrade) {
          setUpgradeRequired(true);
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

  const handleCopyReport = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    toast.success("Report copied to clipboard");
  }, [result]);

  const handleScanAnother = useCallback(() => {
    setConfig("");
    setResult(null);
    setJsonError(null);
    setUpgradeRequired(false);
  }, []);

  const isValid = config.trim().length > 0;

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <h1 className="text-xl font-semibold">New Security Scan</h1>
        <p className="text-muted-foreground">
          Paste your MCP configuration JSON to scan for security vulnerabilities
        </p>
      </div>

      <div className="max-w-3xl space-y-4">
        <Textarea
          value={config}
          onChange={(e) => {
            setConfig(e.target.value);
            setJsonError(null);
          }}
          placeholder={PLACEHOLDER_CONFIG}
          rows={12}
          className="min-h-[280px] resize-y font-mono text-sm leading-relaxed"
          spellCheck={false}
        />

        {jsonError && (
          <p className="text-sm text-red-500">{jsonError}</p>
        )}

        <Button
          type="button"
          size="lg"
          className="h-12 w-full text-base"
          disabled={!isValid || scanning}
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
      </div>

      {upgradeRequired && (
        <Alert variant="destructive" className="max-w-3xl">
          <AlertTitle>Free Scan Limit Reached</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p>You've used all 3 free scans this month. Upgrade to Pro for unlimited scans.</p>
            <Button asChild>
              <a href="/pricing">Upgrade to Pro &mdash; $29/mo</a>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="max-w-3xl space-y-6">
          <ScanResults result={result} />

          <div className="flex gap-3">
            <Button variant="secondary" size="lg" onClick={handleScanAnother}>
              Scan Another
            </Button>
            <Button variant="outline" size="lg" onClick={handleCopyReport}>
              <Copy className="size-4" />
              Copy Report
            </Button>
          </div>
        </div>
      )}
    </main>
  );
};

export default ScanPage;