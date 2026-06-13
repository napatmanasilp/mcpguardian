"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateOrgTimezone } from "@/lib/actions/settings";
import { type ActionState } from "@/lib/types/settings";

interface TimezoneSelectorProps {
  currentTimezone: string;
}

const initialState: ActionState = {};

// Get the full IANA timezone list
const timezones = Intl.supportedValuesOf("timeZone");

export function TimezoneSelector({ currentTimezone }: TimezoneSelectorProps) {
  const [state, formAction, isPending] = useActionState(
    updateOrgTimezone,
    initialState,
  );
  const [selectedTimezone, setSelectedTimezone] = useState(currentTimezone || "UTC");
  const prevStateRef = useRef(state);

  useEffect(() => {
    if (state === prevStateRef.current) return;
    prevStateRef.current = state;

    if (state.success) {
      toast.success("Timezone saved.");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="timezone" value={selectedTimezone} />
      <div className="space-y-2">
        <Label htmlFor="timezone" className="text-xs text-slate-400">
          Timezone
        </Label>
        <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
          <SelectTrigger className="border-white/10 bg-white/5 max-w-md">
            <SelectValue placeholder="Select a timezone" />
          </SelectTrigger>
          <SelectContent>
            {timezones.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="submit"
        size="sm"
        className="bg-blue-600 hover:bg-blue-700"
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Save"
        )}
      </Button>
    </form>
  );
}
