"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function GeneralSettingsError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} />;
}
