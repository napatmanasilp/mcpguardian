"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ActivityErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ActivityError({ error, reset }: ActivityErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message =
    error.message?.slice(0, 200) || "An unexpected error occurred";

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <AlertTriangle className="size-12" style={{ color: "var(--threat)" }} />
      <p className="mt-4 text-sm text-slate-300 max-w-md text-center">
        {message}
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
