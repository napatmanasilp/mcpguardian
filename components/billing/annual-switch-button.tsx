"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AnnualSwitchButtonProps {
  currentPlanId: string;
}

export function AnnualSwitchButton({ currentPlanId }: AnnualSwitchButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSwitch = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: currentPlanId, billing: "annual" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to create checkout session");
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        className="border-emerald-500/30 text-emerald-400 shrink-0"
        disabled={loading}
        onClick={handleSwitch}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Switch to Annual"
        )}
      </Button>
      {error && (
        <p className="text-xs text-red-400 max-w-[200px] text-right">{error}</p>
      )}
    </div>
  );
}
