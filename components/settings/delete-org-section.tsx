"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteOrganization } from "@/lib/actions/settings";
import { type ActionState } from "@/lib/types/settings";
import { isDeleteConfirmEnabled } from "@/lib/utils/settings";

interface DeleteOrgSectionProps {
  orgName: string;
}

const initialState: ActionState = {};

export function DeleteOrgSection({ orgName }: DeleteOrgSectionProps) {
  const router = useRouter();
  const [typedName, setTypedName] = useState("");
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    deleteOrganization,
    initialState,
  );
  const prevStateRef = useRef(state);

  const isConfirmEnabled = isDeleteConfirmEnabled(typedName, orgName);

  useEffect(() => {
    if (state === prevStateRef.current) return;
    prevStateRef.current = state;

    if (state.success) {
      router.push("/signup");
    } else if (state.error) {
      toast.error(state.error);
      setOpen(false);
    }
  }, [state, router]);

  return (
    <Card className="border-threat/50 bg-[hsl(222,47%,6%)]">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-threat">
          Danger Zone
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-slate-400 mb-4">
          Deleting your organization is permanent and cannot be undone. All
          servers, sessions, scans, alerts, and member data will be removed.
        </p>

        <AlertDialog open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) setTypedName("");
        }}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              Delete Organization
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Organization</AlertDialogTitle>
              <AlertDialogDescription>
                This action is irreversible. Type your organization name to
                confirm deletion.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2 py-2">
              <Label htmlFor="confirm-org-name" className="text-xs text-slate-400">
                Type <span className="font-semibold text-slate-200">{orgName}</span> to confirm
              </Label>
              <Input
                id="confirm-org-name"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={orgName}
                className="border-white/10 bg-white/5"
                autoComplete="off"
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </AlertDialogCancel>
              <form action={formAction}>
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={!isConfirmEnabled || isPending}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Confirm Delete"
                  )}
                </Button>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
