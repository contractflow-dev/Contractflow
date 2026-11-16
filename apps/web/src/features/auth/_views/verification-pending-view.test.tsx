import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { VerificationPendingView } from "./verification-pending-view";

const pending = vi.hoisted(() => ({ email: null as string | null }));

vi.mock("../pendingVerificationEmail", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../pendingVerificationEmail")>()),
  readPendingVerificationEmail: () => pending.email,
}));
vi.mock("@/services/authApi", () => ({
  useResendVerificationEmailMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock("@/components/auth/auth-hero", () => ({ AuthHero: () => null }));
vi.mock("@/components/auth/authTopBar", () => ({ AuthTopBar: () => null }));

// The server render has no stored address; render as the browser would.
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useSyncExternalStore: <T,>(_subscribe: unknown, getSnapshot: () => T) =>
      getSnapshot(),
  };
});

describe("VerificationPendingView", () => {
  it("says where the link went, masked, and offers to resend it", () => {
    pending.email = "ada@example.com";
    const markup = renderToStaticMarkup(<VerificationPendingView />);

    expect(markup).toContain("We sent a verification link to");
    expect(markup).toContain("a•••@example.com");
    expect(markup).not.toContain("ada@example.com");
    expect(markup).toMatch(/<button(?![^>]*disabled="")[^>]*>Resend verification email</);
  });

  it("can't resend when it doesn't know the address", () => {
    pending.email = null;
    const markup = renderToStaticMarkup(<VerificationPendingView />);

    expect(markup).toContain("We sent you a verification link.");
    expect(markup).not.toContain("<input");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Resend verification email</);
  });
});
