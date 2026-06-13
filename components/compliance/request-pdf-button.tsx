"use client";

import { useActionState, useEffect, useRef } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { requestPdfReport } from "@/lib/actions/compliance";
import { type ActionState } from "@/lib/types/settings";

const initialState: ActionState = {};

export function RequestPdfButton() {
  const [state, formAction, isPending] = useActionState(
    requestPdfReport,
    initialState,
  );
  const prevStateRef = useRef(state);

  useEffect(() => {
    if (state === prevStateRef.current) return;
    prevStateRef.current = state;

    if (state.success) {
      toast.success("Report is being generated. It will appear in the Reports section within a few minutes.");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form action={formAction} className="w-full">
      <Button
        type="submit"
        variant="outline"
        className="border-white/10 gap-1.5 w-full"
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <FileText className="size-3.5" />
            Request PDF Report
          </>
        )}
      </Button>
    </form>
  );
}
