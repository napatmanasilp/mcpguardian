"use client";

import { useState } from "react";
import { Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface RescanButtonProps {
  serverId: string;
  onSuccess?: (data: { lastScanAt: string; riskScore: number }) => void;
}

export function RescanButton({ serverId, onSuccess }: RescanButtonProps) {
  const [scanning, setScanning] = useState(false);

  async function handleRescan(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setScanning(true);

    try {
      const res = await fetch(`/api/servers/${serverId}/rescan`, {
        method: "POST",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message ?? body.error ?? `Rescan failed (${res.status})`);
      }

      const data = await res.json();
      toast.success("Scan complete");
      onSuccess?.({
        lastScanAt: new Date().toISOString(),
        riskScore: data.data?.riskScore ?? 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rescan failed";
      toast.error(message);
    } finally {
      setScanning(false);
    }
  }

  return (
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
      {scanning ? "Scanning..." : "Rescan"}
    </Button>
  );
}
