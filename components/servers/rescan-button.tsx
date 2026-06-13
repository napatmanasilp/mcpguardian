"use client";

import { useState } from "react";
import { Loader2, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface RescanButtonProps {
  serverId: string;
  onSuccess?: (data: { lastScanAt: string; riskScore: number }) => void;
}

export function RescanButton({ serverId, onSuccess }: RescanButtonProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRescan(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setScanning(true);
    setError(null);

    try {
      const res = await fetch(`/api/servers/${serverId}/rescan`, {
        method: "POST",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Rescan failed (${res.status})`);
      }

      const data = await res.json();
      onSuccess?.({
        lastScanAt: new Date().toISOString(),
        riskScore: data.riskScore ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rescan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={scanning}
        onClick={handleRescan}
        className="gap-1.5 text-xs text-slate-400 hover:text-white"
        aria-label={`Rescan server ${serverId}`}
      >
        {scanning ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RotateCw className="size-3.5" />
        )}
        Rescan
      </Button>
      {error && (
        <span className="text-xs text-red-400 truncate max-w-[160px]" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
