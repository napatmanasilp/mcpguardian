"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrgName } from "@/lib/actions/settings";
import { type ActionState } from "@/lib/types/settings";

interface OrgNameFormProps {
  initialName: string;
}

const initialState: ActionState = {};

export function OrgNameForm({ initialName }: OrgNameFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateOrgName,
    initialState,
  );
  const prevStateRef = useRef(state);

  useEffect(() => {
    if (state === prevStateRef.current) return;
    prevStateRef.current = state;

    if (state.success) {
      toast.success("Organization name saved.");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="orgName" className="text-xs text-slate-400">
          Organization name
        </Label>
        <Input
          id="orgName"
          name="name"
          defaultValue={initialName}
          maxLength={100}
          required
          className="border-white/10 bg-white/5 max-w-md"
        />
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
