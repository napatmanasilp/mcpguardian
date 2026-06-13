// Feature: mcpguardian-ux-improvements, Property 3: Mismatched passwords always block form submission
// **Validates: Requirements 1.7**

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as fc from "fast-check";
import React from "react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({
    get: (key: string) => (key === "code" ? "valid-code" : null),
  }),
}));

// Mock the Supabase client — track updateUser calls
const mockUpdateUser = vi.fn();
const mockExchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      updateUser: mockUpdateUser,
    },
  }),
}));

import { ResetPasswordForm } from "../reset-password-form";

describe("Property 3: Mismatched passwords always block form submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it("for any two distinct strings p1 ≠ p2, form shows inline error and never calls updateUser", async () => {
    const arb = fc
      .tuple(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 })
      )
      .filter(([a, b]) => a !== b);

    await fc.assert(
      fc.asyncProperty(arb, async ([password, confirmPassword]) => {
        mockUpdateUser.mockClear();

        const { unmount } = render(React.createElement(ResetPasswordForm));

        // Wait for the session exchange to complete (sessionReady = true)
        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /reset password/i })
          ).toBeInTheDocument();
        });

        // Fill in password fields
        const passwordInput = screen.getByLabelText(/new password/i);
        const confirmInput = screen.getByLabelText(/confirm password/i);

        fireEvent.change(passwordInput, { target: { value: password } });
        fireEvent.change(confirmInput, { target: { value: confirmPassword } });

        // Submit the form
        const submitButton = screen.getByRole("button", {
          name: /reset password/i,
        });
        fireEvent.click(submitButton);

        // Wait for the mismatch error to appear
        await waitFor(() => {
          const errorElement = screen.getByRole("alert");
          expect(errorElement).toBeInTheDocument();
          expect(errorElement.textContent).toContain(
            "Passwords do not match"
          );
        });

        // updateUser must NOT have been called
        expect(mockUpdateUser).not.toHaveBeenCalled();

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});
