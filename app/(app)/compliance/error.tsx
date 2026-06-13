"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function ComplianceError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} />;
}
