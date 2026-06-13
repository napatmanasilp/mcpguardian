"use client";

import { useCallback } from "react";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useOptimisticToggle } from "@/lib/hooks/use-optimistic-toggle";

interface NotificationToggleProps {
  /** Initial enabled state for email notifications */
  initialEnabled: boolean;
  /** Organization ID for the toggle action */
  organizationId: string;
}

/**
 * Settings toggle for email alert notifications.
 * Implements optimistic update pattern (Req 17.3, 17.4, 17.5):
 * - Reflects toggled state within 100ms
 * - Reverts + shows error toast on failure
 * - Ignores duplicate clicks while in flight
 */
export function NotificationToggle({
  initialEnabled,
  organizationId,
}: NotificationToggleProps) {
  const action = useCallback(
    async (newValue: boolean): Promise<{ error?: string } | void> => {
      const res = await fetch("/api/alerts/channels/toggle-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          enabled: newValue,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { error: data.error || "Failed to update" };
      }
    },
    [organizationId],
  );

  const { value, isPending, toggle } = useOptimisticToggle({
    initialValue: initialEnabled,
    action,
    errorMessage: "Could not update notification preference",
  });

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label
          htmlFor="email-notifications"
          className="text-sm font-medium text-slate-200"
        >
          Email notifications
        </Label>
        <p className="text-xs text-slate-500">
          Receive email alerts when security events are detected.
        </p>
      </div>
      <Switch
        id="email-notifications"
        checked={value}
        onCheckedChange={toggle}
        disabled={isPending}
        aria-label="Toggle email notifications"
      />
    </div>
  );
}
