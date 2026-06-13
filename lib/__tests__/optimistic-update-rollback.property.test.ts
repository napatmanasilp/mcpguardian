// Feature: ui-launch-readiness, Property 6: Optimistic update rollback
// **Validates: Requirements 17.2, 17.4**

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useOptimisticToggle } from "@/lib/hooks/use-optimistic-toggle";

// Mock sonner toast
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
  },
}));

describe("Property 6: Optimistic update rollback", () => {
  beforeEach(() => {
    mockToastError.mockClear();
  });

  it("reverts to pre-action value and shows error toast when action returns { error } (Req 17.2, 17.4)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // random initial value
        fc.string({ minLength: 1, maxLength: 100 }), // random error message
        async (initialValue, errorMessage) => {
          mockToastError.mockClear();

          // Create a failing action that returns an error object
          const action = vi
            .fn()
            .mockResolvedValue({ error: "Server failure" });

          const { result } = renderHook(() =>
            useOptimisticToggle({
              initialValue,
              action,
              errorMessage,
            })
          );

          // Initial state matches
          expect(result.current.value).toBe(initialValue);

          // Trigger toggle
          act(() => {
            result.current.toggle();
          });

          // Immediately after toggle, value should be flipped (optimistic)
          expect(result.current.value).toBe(!initialValue);

          // Wait for the action to complete and rollback to occur
          await waitFor(() => {
            expect(result.current.isPending).toBe(false);
          });

          // After failure, value should revert to original
          expect(result.current.value).toBe(initialValue);

          // Error toast must have been called with the specified message
          expect(mockToastError).toHaveBeenCalledWith(errorMessage);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("reverts to pre-action value and shows error toast when action throws (Req 17.2, 17.4)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // random initial value
        fc.string({ minLength: 1, maxLength: 100 }), // random error message
        fc.string({ minLength: 1, maxLength: 50 }), // random thrown error text
        async (initialValue, errorMessage, thrownError) => {
          mockToastError.mockClear();

          // Create a failing action that throws
          const action = vi
            .fn()
            .mockRejectedValue(new Error(thrownError));

          const { result } = renderHook(() =>
            useOptimisticToggle({
              initialValue,
              action,
              errorMessage,
            })
          );

          // Initial state matches
          expect(result.current.value).toBe(initialValue);

          // Trigger toggle
          act(() => {
            result.current.toggle();
          });

          // Immediately after toggle, value should be flipped (optimistic)
          expect(result.current.value).toBe(!initialValue);

          // Wait for the action to reject and rollback to occur
          await waitFor(() => {
            expect(result.current.isPending).toBe(false);
          });

          // After failure, value should revert to original
          expect(result.current.value).toBe(initialValue);

          // Error toast must have been called with the specified message
          expect(mockToastError).toHaveBeenCalledWith(errorMessage);
        }
      ),
      { numRuns: 100 }
    );
  });
});
