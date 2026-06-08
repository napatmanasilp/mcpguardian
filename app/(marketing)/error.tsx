"use client";

interface MarketingErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const MarketingError = ({ reset }: MarketingErrorProps) => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <p className="text-sm text-muted-foreground">
        Something went wrong loading this page.
      </p>
      <button
        type="button"
        onClick={reset}
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Try again
      </button>
    </div>
  );
};

export default MarketingError;
