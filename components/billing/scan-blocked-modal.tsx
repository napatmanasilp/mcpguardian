"use client";

import { Bolt, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { openTopUpModal } from "@/lib/usage";

interface ScanBlockedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: string;
  checksUsed: number;
  checksIncluded: number;
  checksPurchased: number;
  resetDate: string;
  unscannedServers?: number;
}

export const ScanBlockedModal = ({
  open,
  onOpenChange,
  plan,
  checksUsed,
  checksIncluded,
  checksPurchased,
  resetDate,
  unscannedServers = 0,
}: ScanBlockedModalProps) => {
  const resetDays = Math.max(
    0,
    Math.ceil(
      (new Date(resetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    ),
  );

  // State B: Limit reached - Free user
  if (plan === "free") {
    const hasTopUpCredits = checksPurchased > 0;
    const allExhausted = checksUsed >= checksIncluded + checksPurchased;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <span className="text-xl">🚫</span>
              {allExhausted
                ? "No checks remaining"
                : "Monthly limit reached"}
            </DialogTitle>
            <DialogDescription>
              {allExhausted ? (
                <>
                  You&apos;ve used your {checksIncluded} free checks and all
                  purchased credits.
                </>
              ) : (
                <>
                  You&apos;ve used all {checksIncluded} free checks for this
                  month.
                </>
              )}
              {unscannedServers > 0 && (
                <>
                  {" "}
                  {unscannedServers} of your server
                  {unscannedServers > 1 ? "s" : ""} {unscannedServers > 1 ? "are" : "is"}{" "}
                  now unscanned.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-4">
            <Button
              variant="default"
              size="lg"
              className="gap-2 w-full"
              onClick={() => {
                onOpenChange(false);
                openTopUpModal();
              }}
            >
              <Bolt className="size-4" />
              {allExhausted ? "Buy More Credits" : "Buy Credits — from $5"}
            </Button>
            <Button variant="outline" size="lg" className="gap-2 w-full" asChild>
              <Link href="/billing/upgrade" onClick={() => onOpenChange(false)}>
                <ChevronRight className="size-4" />
                Upgrade to Developer — $19/mo
              </Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Or wait &mdash; resets in {resetDays} day{resetDays !== 1 ? "s" : ""}
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
};
