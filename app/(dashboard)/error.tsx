"use client";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const DashboardError = ({ reset }: DashboardErrorProps) => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <p className="text-sm text-muted-foreground">
        Something went wrong in the dashboard.
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

export default DashboardError;
