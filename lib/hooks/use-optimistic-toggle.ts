"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

interface UseOptimisticToggleOptions {
  /** Initial value of the boolean setting */
  initialValue: boolean;
  /** Server action to persist the toggle. Should throw or return { error } on failure. */
  action: (newValue: boolean) => Promise<{ error?: string } | void>;
  /** Error message shown in toast on failure (defaults to "Could not save setting") */
  errorMessage?: string;
}

interface UseOptimisticToggleReturn {
  /** Current optimistic value (reflects toggled state immediately) */
  value: boolean;
  /** Whether the action is currently in flight */
  isPending: boolean;
  /** Toggle handler — call this on user interaction */
  toggle: () => void;
}

/**
 * Hook implementing optimistic toggle updates for boolean settings.
 *
 * Pattern:
 * 1. User clicks → immediately update UI state (< 100ms) (Req 17.3)
 * 2. Fire server action in background
 * 3. On success: state already reflects correct value
 * 4. On failure: revert to pre-action value + show error toast (Req 17.4)
 * 5. Ignore duplicate clicks while action is in-flight (Req 17.5)
 */
export function useOptimisticToggle({
  initialValue,
  action,
  errorMessage = "Could not save setting",
}: UseOptimisticToggleOptions): UseOptimisticToggleReturn {
  const [value, setValue] = useState(initialValue);
  const inFlightRef = useRef(false);
  const [isPending, setIsPending] = useState(false);

  const toggle = useCallback(() => {
    // Ignore duplicate clicks while action is in flight (Req 17.5)
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsPending(true);

    const previousValue = value;
    const newValue = !value;

    // Optimistic update — reflect immediately (< 100ms) (Req 17.3)
    setValue(newValue);

    // Fire server action in background
    action(newValue)
      .then((result) => {
        if (result && result.error) {
          // Server returned an error — revert + toast (Req 17.4)
          setValue(previousValue);
          toast.error(errorMessage);
        }
      })
      .catch(() => {
        // Network or unexpected error — revert + toast (Req 17.4)
        setValue(previousValue);
        toast.error(errorMessage);
      })
      .finally(() => {
        inFlightRef.current = false;
        setIsPending(false);
      });
  }, [value, action, errorMessage]);

  return { value, isPending, toggle };
}
