// Feature: mcpguardian-ux-improvements, Property 4: Weak password blocks signup submission
// **Validates: Requirements 5.9**

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import React from "react";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Track whether the signup server action is called
const mockSignUpWithEmail = vi.fn().mockResolvedValue({});

vi.mock("@/lib/actions/auth", () => ({
  signUpWithEmail: (...args: unknown[]) => mockSignUpWithEmail(...args),
}));

// Mock supabase client for OAuth buttons
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      resend: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

vi.mock("@/lib/supabase/env", () => ({
  getSiteUrl: () => "http://localhost:3000",
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Import the component after mocks are set up
import { SignupForm } from "@/components/auth/signup-form";

/**
 * Arbitrary for weak passwords: any string of length 0–7.
 * By the computeStrength spec, any password with length < 8 is classified as "weak".
 */
const weakPasswordArbitrary = fc.string({ minLength: 0, maxLength: 7 });

describe("Property 4: Weak password blocks signup submission", () => {
  beforeEach(() => {
    mockSignUpWithEmail.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows inline error and does NOT invoke signup action for any weak password", async () => {
    await fc.assert(
      fc.asyncProperty(weakPasswordArbitrary, async (weakPassword) => {
        cleanup();
        mockSignUpWithEmail.mockClear();

        render(<SignupForm />);

        // Fill in email (required for the form to be valid)
        const emailInput = screen.getByLabelText(/email/i);
        fireEvent.change(emailInput, { target: { value: "test@example.com" } });

        // Fill in the weak password
        const passwordInput = screen.getByLabelText(/password/i);
        fireEvent.change(passwordInput, { target: { value: weakPassword } });

        // Attempt form submission
        const form = passwordInput.closest("form")!;
        fireEvent.submit(form);

        // The inline error should be displayed
        await waitFor(() => {
          const errorElement = screen.getByRole("alert");
          expect(errorElement).toBeTruthy();
          expect(errorElement.textContent).toContain("too weak");
        });

        // The signup server action must NOT have been called
        expect(mockSignUpWithEmail).not.toHaveBeenCalled();

        cleanup();
      }),
      { numRuns: 100 }
    );
  });
});
