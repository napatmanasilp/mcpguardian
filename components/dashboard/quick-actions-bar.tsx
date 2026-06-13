"use client";

import { useRouter } from "next/navigation";
import { Bell, Plus, ScanSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolveScanNowTarget } from "@/lib/utils/navigation";

interface QuickActionsBarProps {
  mostRecentServerId: string | null;
}

export function QuickActionsBar({ mostRecentServerId }: QuickActionsBarProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-bg-surface px-4 py-3">
      <Button
        size="sm"
        variant="outline"
        className="border-white/10 gap-1.5"
        onClick={() => {
          // Use resolveScanNowTarget with a single-element array when we have
          // a pre-resolved mostRecentServerId, or empty array for fallback
          const target = mostRecentServerId
            ? `/servers/${mostRecentServerId}`
            : resolveScanNowTarget([]);
          router.push(target);
        }}
      >
        <ScanSearch className="size-3.5" />
        Scan Now
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="border-white/10 gap-1.5"
        onClick={() => router.push("/servers/new")}
      >
        <Plus className="size-3.5" />
        Add Server
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="border-white/10 gap-1.5"
        onClick={() => router.push("/alerts")}
      >
        <Bell className="size-3.5" />
        View Alerts
      </Button>
    </div>
  );
}
