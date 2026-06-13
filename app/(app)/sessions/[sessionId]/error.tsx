"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function SessionDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message =
    error.message?.slice(0, 200) || "An unexpected error occurred";

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <AlertTriangle className="size-12" style={{ color: "var(--threat)" }} />
      <p className="mt-4 text-sm text-slate-300">{message}</p>
      <div className="mt-4 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
