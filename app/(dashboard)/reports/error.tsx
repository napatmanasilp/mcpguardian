"use client";

interface ReportsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const ReportsError = ({ reset }: ReportsErrorProps) => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <p className="text-sm text-muted-foreground">Unable to load reports.</p>
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

export default ReportsError;
