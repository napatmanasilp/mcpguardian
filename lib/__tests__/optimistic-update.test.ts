/**
 * Unit tests for optimistic update patterns.
 * Validates Requirements 17.1, 17.2, 17.3, 17.4, 17.5
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useOptimisticToggle } from "@/lib/hooks/use-optimistic-toggle";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("useOptimisticToggle", () => {
  it("reflects toggled state immediately (< 100ms) (Req 17.3)", async () => {
    const action = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useOptimisticToggle({
        initialValue: false,
        action,
      }),
    );

    expect(result.current.value).toBe(false);

    act(() => {
      result.current.toggle();
    });

    // Value should be toggled immediately (synchronous in same tick)
    expect(result.current.value).toBe(true);
  });

  it("remains in new state on successful action", async () => {
    const action = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useOptimisticToggle({
        initialValue: true,
        action,
      }),
    );

    act(() => {
      result.current.toggle();
    });

    expect(result.current.value).toBe(false);

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    // Value stays false after successful action
    expect(result.current.value).toBe(false);
    expect(action).toHaveBeenCalledWith(false);
  });

  it("reverts to previous state on action returning error (Req 17.4)", async () => {
    const { toast } = await import("sonner");
    const action = vi.fn().mockResolvedValue({ error: "Network failure" });

    const { result } = renderHook(() =>
      useOptimisticToggle({
        initialValue: true,
        action,
        errorMessage: "Could not save setting",
      }),
    );

    act(() => {
      result.current.toggle();
    });

    // Immediately reflects new state
    expect(result.current.value).toBe(false);

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    // Reverts on error
    expect(result.current.value).toBe(true);
    expect(toast.error).toHaveBeenCalledWith("Could not save setting");
  });

  it("reverts to previous state on action throwing (Req 17.4)", async () => {
    const { toast } = await import("sonner");
    const action = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() =>
      useOptimisticToggle({
        initialValue: false,
        action,
        errorMessage: "Could not update notification preference",
      }),
    );

    act(() => {
      result.current.toggle();
    });

    expect(result.current.value).toBe(true);

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    // Reverts on network error
    expect(result.current.value).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      "Could not update notification preference",
    );
  });

  it("ignores duplicate clicks while action is in flight (Req 17.5)", async () => {
    let resolveAction: (() => void) | undefined;
    const action = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useOptimisticToggle({
        initialValue: false,
        action,
      }),
    );

    // First toggle
    act(() => {
      result.current.toggle();
    });

    expect(result.current.value).toBe(true);
    expect(result.current.isPending).toBe(true);

    // Second toggle while in flight — should be ignored
    act(() => {
      result.current.toggle();
    });

    // Value should NOT have toggled back
    expect(result.current.value).toBe(true);
    // Action should only have been called once
    expect(action).toHaveBeenCalledTimes(1);

    // Resolve the action
    act(() => {
      resolveAction?.();
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.value).toBe(true);
  });

  it("uses default error message when none provided", async () => {
    const { toast } = await import("sonner");
    const action = vi.fn().mockResolvedValue({ error: "fail" });

    const { result } = renderHook(() =>
      useOptimisticToggle({
        initialValue: true,
        action,
      }),
    );

    act(() => {
      result.current.toggle();
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(toast.error).toHaveBeenCalledWith("Could not save setting");
  });
});
