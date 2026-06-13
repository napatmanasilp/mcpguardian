"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  error: Error;
  reset: () => void;
}

export function ErrorState({ error, reset }: ErrorStateProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message =
    error.message && error.message.length > 0
      ? error.message.length > 200
        ? error.message.slice(0, 200) + "…"
        : error.message
      : "An unexpected error occurred";

  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center justify-center rounded-xl border p-8"
      style={{ backgroundColor: "var(--bg-surface)" }}
    >
      <AlertTriangle
        className="size-12"
        style={{ color: "var(--threat)" }}
        aria-hidden="true"
      />
      <p className="mt-4 text-center text-sm text-slate-300">{message}</p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
