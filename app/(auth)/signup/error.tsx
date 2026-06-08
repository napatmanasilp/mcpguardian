"use client";

interface SignupErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const SignupError = ({ reset }: SignupErrorProps) => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <p className="text-sm text-muted-foreground">Unable to load signup.</p>
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

export default SignupError;
