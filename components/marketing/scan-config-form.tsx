"use client";

import { useState } from "react";
import Link from "next/link";
import { ScanSearch } from "lucide-react";

import { SecurityGradeBadge } from "@/components/security-grade-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Textarea
        value={config}
        onChange={(event) => setConfig(event.target.value)}
        placeholder={SAMPLE_CONFIG}
        rows={10}
        className="min-h-[220px] resize-y font-mono text-sm leading-relaxed"
        spellCheck={false}
      />

      {isAuthenticated ? (
        <Button type="button" size="lg" className="h-12 w-full text-base" asChild>
          <Link href="/scan">
            <ScanSearch className="size-5" aria-hidden />
            Scan Now
          </Link>
        </Button>
      ) : (
        <Button type="button" size="lg" className="h-12 w-full text-base" asChild>
          <Link href="/signup">
            <ScanSearch className="size-5" aria-hidden />
            Scan Now
          </Link>
        </Button>
      )}

      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-5 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="text-sm font-medium">Sample security grade</p>
          <p className="text-xs text-muted-foreground">
            Paste your config above to scan for real results
          </p>
        </div>
        <SecurityGradeBadge grade="B" size="lg" label="2 issues found" />
      </div>
    </div>
  );
};
