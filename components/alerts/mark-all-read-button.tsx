"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { markAllAlertsRead } from "@/lib/actions/alerts";
import { type ActionState } from "@/lib/types/settings";

const initialState: ActionState = {};

export function MarkAllReadButton() {
  const [state, formAction, isPending] = useActionState(
    markAllAlertsRead,
    initialState,
  );
  const prevStateRef = useRef(state);

  useEffect(() => {
    if (state === prevStateRef.current) return;
    prevStateRef.current = state;

    if (state.success) {
      toast.success("All alerts marked as read.");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="border-white/10 gap-1.5"
        disabled={isPending}
      >
        {isPending && <Loader2 className="size-3.5 animate-spin" />}
        {isPending ? "Marking…" : "Mark All Read"}
      </Button>
    </form>
  );
}
