"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface DynamicLoadErrorProps {
  /** A human-readable name for the component that failed to load */
  componentName?: string;
  /** Callback to retry loading the component */
  onRetry?: () => void;
}

/**
 * Inline error state shown when a dynamically imported component fails to load.
 * Provides a non-blocking error message with a retry action (Requirement 20.5).
 */
export function DynamicLoadError({
  componentName = "component",
  onRetry,
}: DynamicLoadErrorProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = useCallback(() => {
    if (onRetry) {
      setRetrying(true);
      onRetry();
      // Reset retrying state after a brief delay (the component will remount on success)
      setTimeout(() => setRetrying(false), 3000);
    } else {
      // Fallback: reload the page
      window.location.reload();
    }
  }, [onRetry]);

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-white/10 bg-[color:var(--bg-surface)] px-4 py-3"
      role="alert"
    >
      <AlertTriangle className="size-5 shrink-0 text-[color:var(--caution)]" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-300">
          Failed to load {componentName}. Check your connection and try again.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRetry}
        disabled={retrying}
        className="shrink-0 gap-1.5"
      >
        <RefreshCw className={`size-3.5 ${retrying ? "animate-spin" : ""}`} />
        {retrying ? "Retrying…" : "Retry"}
      </Button>
    </div>
  );
}
