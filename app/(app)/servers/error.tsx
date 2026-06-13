"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function ServersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <ErrorState error={error} reset={reset} />
    </div>
  );
}
