"use client";

import { useEffect, useState } from "react";
import {
  Bolt,
  Check,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TOP_UP_BUNDLES, type TopUpBundle } from "@/lib/plan-limits";
import {
  registerTopUpModal,
  unregisterTopUpModal,
  useUsage,
} from "@/lib/usage";
import { cn } from "@/lib/utils";

interface TopUpModalProps {
  defaultBundle?: string;
}

export const TopUpModalProvider = () => {
  const [open, setOpen] = useState(false);
  const [defaultBundleId, setDefaultBundleId] = useState<string | undefined>();
  const { usage } = useUsage();

  useEffect(() => {
    registerTopUpModal((bundleId) => {
      setDefaultBundleId(bundleId);
      setOpen(true);
    });
    return () => unregisterTopUpModal();
  }, []);

  return (
    <TopUpModal
      open={open}
      onOpenChange={setOpen}
      defaultBundleId={defaultBundleId}
      hasToppedUpBefore={(usage?.checksPurchased ?? 0) > 0}
    />
  );
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBundleId?: string;
  hasToppedUpBefore: boolean;
}

const TopUpModal = ({
  open,
  onOpenChange,
  defaultBundleId,
  hasToppedUpBefore,
}: Props) => {
  const [selectedBundle, setSelectedBundle] = useState<string>(
    defaultBundleId ?? (hasToppedUpBefore ? "bundle-c" : "bundle-b"),
  );
  const [purchasing, setPurchasing] = useState(false);
  const { usage, refetch } = useUsage();

  // Reset selection when modal opens
  useEffect(() => {
    if (open) {
      setSelectedBundle(
        defaultBundleId ?? (hasToppedUpBefore ? "bundle-c" : "bundle-b"),
      );
    }
  }, [open, defaultBundleId, hasToppedUpBefore]);

  const bundle = TOP_UP_BUNDLES.find((b) => b.id === selectedBundle);
  const currentBalance = usage?.checksPurchased ?? 0;

  const handlePurchase = async () => {
    if (!bundle) return;
    setPurchasing(true);

    try {
      const res = await fetch("/api/billing/top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId: bundle.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Purchase failed. Please try again.");
        return;
      }

      toast.success(data.message);
      await refetch();
      onOpenChange(false);
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bolt className="size-5 text-amber-400" />
            Buy Check Credits
          </DialogTitle>
          <DialogDescription>
            {usage && usage.checksUsed >= usage.checksIncluded
              ? "You've used all your free checks this month. Buy credits to keep scanning without upgrading."
              : "Buy credits to keep scanning without upgrading. Credits roll over for up to 12 months."}
          </DialogDescription>
        </DialogHeader>

        {/* Bundle options */}
        <div className="grid gap-3 py-2">
          {TOP_UP_BUNDLES.map((b) => {
            const isSelected = selectedBundle === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBundle(b.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border hover:border-muted-foreground/30",
                )}
              >
                <div
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40",
                  )}
                >
                  {isSelected && <Check className="size-3" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      ${b.price} &rarr; {b.checks.toLocaleString()} checks
                    </span>
                    {b.badge && (
                      <Badge
                        variant="default"
                        className="text-[10px] px-1.5 py-0"
                      >
                        <Sparkles className="size-2.5 mr-0.5" />
                        {b.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ${(b.price / b.checks).toFixed(4)}/check
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Current balance */}
        <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Current balance: {currentBalance.toLocaleString()} credits remaining
        </div>

        {/* Compare tip */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Compare:</span>{" "}
          Developer plan = $19/mo for 2,000 checks. If you need more than
          2,000 checks/month regularly, upgrading is cheaper.{" "}
          <Link
            href="/billing/upgrade"
            className="text-primary underline-offset-2 hover:underline"
            onClick={() => onOpenChange(false)}
          >
            See upgrade options &rarr;
          </Link>
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={purchasing}
          >
            Cancel
          </Button>
          <Button onClick={handlePurchase} disabled={!bundle || purchasing}>
            {purchasing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Buy $${bundle?.price ?? 0} of Credits &rarr;`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
