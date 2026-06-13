"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Alert } from "@/lib/types/alerts";

interface AlertRowProps {
  alert: Alert;
}

export function AlertRow({ alert }: AlertRowProps) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const severityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return <span className="size-3 rounded-full bg-red-500 shrink-0" />;
      case "high":
        return <span className="size-3 rounded-full bg-orange-500 shrink-0" />;
      case "medium":
        return <span className="size-3 rounded-full bg-yellow-500 shrink-0" />;
      default:
        return <span className="size-3 rounded-full bg-blue-500 shrink-0" />;
    }
  };

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  /**
   * Resolves the navigation target based on alert fields:
   * 1. session_id non-null → /sessions/{session_id}
   * 2. server_id non-null → /servers/{server_id}
   * 3. Both null → /activity
   */
  const resolveTarget = (): string => {
    if (alert.session_id) return `/sessions/${alert.session_id}`;
    if (alert.server_id) return `/servers/${alert.server_id}`;
    return "/activity";
  };

  const handleClick = async () => {
    if (isNavigating) return;
    setIsNavigating(true);

    try {
      // Step 1: Mark alert as read
      const res = await fetch(`/api/alerts/${alert.id}/mark-read`, {
        method: "POST",
      });

      // Step 2: Resolve navigation target
      let target = resolveTarget();

      // Handle 404 — the referenced session/server no longer exists
      if (res.status === 404) {
        target = "/activity";
      }

      // Step 3: Navigate
      router.push(target);
    } catch {
      // On network error, fall back to /activity
      router.push("/activity");
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        "flex items-start gap-4 rounded-lg border px-4 py-3 transition-colors hover:bg-white/[0.03] cursor-pointer",
        isNavigating && "opacity-60 pointer-events-none",
        !alert.read
          ? "border-l-4 border-l-blue-500 border-white/10 bg-[hsl(222,47%,6%)]"
          : "border-white/5 bg-white/[0.02]",
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          {severityIcon(alert.severity)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "text-sm font-medium truncate",
                !alert.read ? "text-slate-200" : "text-slate-400",
              )}
            >
              {alert.title}
            </p>
            <Badge
              variant={
                alert.severity.toLowerCase() === "critical"
                  ? "destructive"
                  : alert.severity.toLowerCase() === "high"
                    ? "default"
                    : "secondary"
              }
              className="text-[9px] shrink-0"
            >
              {alert.severity}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
            {alert.message}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            {relativeTime(alert.created_at)}
          </p>
        </div>
      </div>
      {!alert.read && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" />
      )}
    </div>
  );
}
