"use client";

interface BillingErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const BillingError = ({ reset }: BillingErrorProps) => {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <p className="text-sm text-muted-foreground">
        Unable to load billing information.
      </p>
      <button
        type="button"
        onClick={reset}
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Try again
      </button>
    </main>
  );
};

export default BillingError;
