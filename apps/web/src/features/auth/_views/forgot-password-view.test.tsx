import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ForgotPasswordView, RESET_REQUESTED_MESSAGE } from "./forgot-password-view";

vi.mock("@/services/authApi", () => ({
  useForgotPasswordMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock("@/components/auth/auth-hero", () => ({ AuthHero: () => null }));
vi.mock("@/components/auth/authTopBar", () => ({ AuthTopBar: () => null }));

describe("ForgotPasswordView", () => {
  it("asks for the sign-in email with a labelled field and a way back", () => {
    const markup = renderToStaticMarkup(<ForgotPasswordView />);

    expect(markup).toMatch(/<h1[^>]*>Forgot your password\?<\/h1>/);
    expect(markup).toContain('aria-label="Request a password reset"');
    expect(markup).toMatch(/<label[^>]*for="forgot-email"[^>]*>Email/);
    const input = markup.match(/<input[^>]*id="forgot-email"[^>]*>/)?.[0];
    expect(input).toContain('type="email"');
    expect(input).toContain('autoComplete="email"');
    // A visible label, not a placeholder.
    expect(input).not.toContain("placeholder=");
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*>Send reset link<\/button>/);
    expect(markup).toContain('href="/login"');
  });

  it("uses a confirmation that never says whether the account exists", () => {
    expect(RESET_REQUESTED_MESSAGE).toBe(
      "If an account exists for this email address, password reset instructions will be sent.",
    );
  });
});
