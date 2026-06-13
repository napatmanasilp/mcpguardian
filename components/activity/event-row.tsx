"use client";

import Link from "next/link";
import { AlertTriangle, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MergedEvent } from "@/lib/types/activity";

interface EventRowProps {
  event: MergedEvent;
}

/**
 * Resolves the link target for an event row based on session_id / server_id priority.
 * - session_id non-null → /sessions/{session_id} (regardless of server_id)
 * - session_id null, server_id non-null → /servers/{server_id}
 * - both null → null (non-interactive)
 */
export function resolveEventHref(event: MergedEvent): string | null {
  if (event.session_id != null) {
    return `/sessions/${event.session_id}`;
  }
  if (event.server_id != null) {
    return `/servers/${event.server_id}`;
  }
  return null;
}

export function EventRow({ event }: EventRowProps) {
  const href = resolveEventHref(event);

  const content = (
    <>
      <div
        className={cn(
          "size-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          event.severity === "critical"
            ? "bg-threat/20"
            : event.severity === "high"
              ? "bg-caution/20"
              : "bg-slate-500/20"
        )}
      >
        {event.type === "threat" ? (
          <ShieldAlert
            className={cn(
              "size-4",
              event.severity === "critical" ? "text-threat" : "text-caution"
            )}
          />
        ) : (
          <AlertTriangle
            className={cn(
              "size-4",
              event.severity === "critical" ? "text-threat" : "text-caution"
            )}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-200 truncate">
            {event.title}
          </p>
          <Badge
            variant={event.severity === "critical" ? "destructive" : "secondary"}
            className="text-[9px] shrink-0"
          >
            {event.severity}
          </Badge>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">{event.description}</p>
        <p className="text-[10px] text-slate-500 mt-1">
          {new Date(event.createdAt).toLocaleString()}
        </p>
      </div>
    </>
  );

  const sharedClassName = cn(
    "flex items-start gap-3 rounded-lg border px-3 py-3 md:px-4 transition-all duration-150 hover:-translate-y-px",
    event.severity === "critical"
      ? "border-threat/20 bg-threat/5 hover:bg-threat/8"
      : event.severity === "high"
        ? "border-caution/20 bg-caution/5 hover:bg-caution/8"
        : "border-white/10 bg-white/5 hover:bg-white/[0.07]"
  );

  if (href) {
    return (
      <Link href={href} className={sharedClassName}>
        {content}
      </Link>
    );
  }

  return <div className={sharedClassName}>{content}</div>;
}
