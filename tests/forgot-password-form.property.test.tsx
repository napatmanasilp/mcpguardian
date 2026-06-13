// Feature: mcpguardian-ux-improvements, Property 1: Forgot-password form shows success for any valid email
// **Validates: Requirements 1.3, 1.4**

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

// Mock supabase client - behavior controlled per test via mockResetPasswordForEmail
const mockResetPasswordForEmail = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  }),
}));

vi.mock("@/lib/supabase/env", () => ({
  getSiteUrl: () => "http://localhost:3000",
}));

// Import the component after mocks are set up
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

/**
 * fast-check arbitrary for syntactically valid email strings that pass
 * the HTML5 <input type="email"> validation (per the WHATWG spec).
 * Generates emails in the form: localAlpha[localRest]@domainAlpha[domainRest].tld
 * - local part starts with an alphanumeric char, followed by 0-19 valid chars
 * - domain part starts with an alphanumeric char, followed by 0-14 alphanumeric chars
 * - TLD is 2-6 alpha chars
 */
const alphanumChar = fc.constantFrom(
  ..."abcdefghijklmnopqrstuvwxyz0123456789".split("")
);
const tldChars = fc.constantFrom(
  ..."abcdefghijklmnopqrstuvwxyz".split("")
);

const validEmailArbitrary = fc
  .tuple(
    alphanumChar,
    fc.string({
      unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789._-".split("")),
      minLength: 0,
      maxLength: 19,
    }),
    alphanumChar,
    fc.string({
      unit: alphanumChar,
      minLength: 0,
      maxLength: 14,
    }),
    fc.string({ unit: tldChars, minLength: 2, maxLength: 6 })
  )
  .map(
    ([localStart, localRest, domainStart, domainRest, tld]) =>
      `${localStart}${localRest}@${domainStart}${domainRest}.${tld}`
  );

describe("Property 1: Forgot-password form shows success for any valid email", () => {
  beforeEach(() => {
    mockResetPasswordForEmail.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("transitions to success state for any valid email when Supabase returns success", async () => {
    await fc.assert(
      fc.asyncProperty(validEmailArbitrary, async (email) => {
        cleanup();
        // Supabase returns success (email is registered)
        mockResetPasswordForEmail.mockResolvedValue({ error: null });

        render(<ForgotPasswordForm />);

        // Fill in the email field and submit the form directly
        const emailInput = screen.getByLabelText(/email/i);
        fireEvent.change(emailInput, { target: { value: email } });

        // Submit the form directly (bypasses native HTML5 validation which is browser-specific)
        const form = emailInput.closest("form")!;
        fireEvent.submit(form);

        // Wait for the success state
        await waitFor(() => {
          expect(screen.getByText("Check your email")).toBeTruthy();
        });

        // Verify no registration status is revealed - the message should be generic
        expect(
          screen.getByText(/if an account exists with that email/i)
        ).toBeTruthy();

        // Ensure the text does NOT reveal whether the email is registered or not
        expect(screen.queryByText(/not registered/i)).toBeNull();
        expect(screen.queryByText(/email not found/i)).toBeNull();
        expect(screen.queryByText(/no account/i)).toBeNull();

        cleanup();
      }),
      { numRuns: 50 }
    );
  });

  it("transitions to success state for any valid email when Supabase returns 'user not found' error", async () => {
    await fc.assert(
      fc.asyncProperty(validEmailArbitrary, async (email) => {
        cleanup();
        // Supabase returns an error for unregistered email (NOT rate-limit)
        mockResetPasswordForEmail.mockResolvedValue({
          error: { message: "User not found", status: 404 },
        });

        render(<ForgotPasswordForm />);

        // Fill in the email field and submit the form directly
        const emailInput = screen.getByLabelText(/email/i);
        fireEvent.change(emailInput, { target: { value: email } });

        const form = emailInput.closest("form")!;
        fireEvent.submit(form);

        // Should still show success - preventing email enumeration
        await waitFor(() => {
          expect(screen.getByText("Check your email")).toBeTruthy();
        });

        // The same generic message is shown
        expect(
          screen.getByText(/if an account exists with that email/i)
        ).toBeTruthy();

        // No enumeration information leaked
        expect(screen.queryByText(/not registered/i)).toBeNull();
        expect(screen.queryByText(/email not found/i)).toBeNull();
        expect(screen.queryByText(/no account/i)).toBeNull();
        expect(screen.queryByText(/user not found/i)).toBeNull();

        cleanup();
      }),
      { numRuns: 50 }
    );
  });

  it("transitions to success state for any valid email when Supabase throws a network error", async () => {
    await fc.assert(
      fc.asyncProperty(validEmailArbitrary, async (email) => {
        cleanup();
        // Supabase throws (network error)
        mockResetPasswordForEmail.mockRejectedValue(
          new Error("Network error")
        );

        render(<ForgotPasswordForm />);

        // Fill in the email field and submit the form directly
        const emailInput = screen.getByLabelText(/email/i);
        fireEvent.change(emailInput, { target: { value: email } });

        const form = emailInput.closest("form")!;
        fireEvent.submit(form);

        // Should still show success to prevent enumeration
        await waitFor(() => {
          expect(screen.getByText("Check your email")).toBeTruthy();
        });

        // Generic message, no leak
        expect(
          screen.getByText(/if an account exists with that email/i)
        ).toBeTruthy();

        cleanup();
      }),
      { numRuns: 50 }
    );
  });
});
