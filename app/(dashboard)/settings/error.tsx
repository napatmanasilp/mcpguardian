"use client";

interface SettingsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const SettingsError = ({ reset }: SettingsErrorProps) => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <p className="text-sm text-muted-foreground">Unable to load settings.</p>
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

export default SettingsError;
