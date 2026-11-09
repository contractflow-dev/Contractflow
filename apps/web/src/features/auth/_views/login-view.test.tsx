import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginView } from "./login-view";

const navigation = vi.hoisted(() => ({ params: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => navigation.params,
}));
vi.mock("@/services/authApi", () => ({
  useLoginMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock("@/components/auth/auth-hero", () => ({ AuthHero: () => null }));
vi.mock("@/components/auth/authTopBar", () => ({ AuthTopBar: () => null }));

function render(search = "") {
  navigation.params = new URLSearchParams(search);
  return renderToStaticMarkup(<LoginView />);
}

describe("LoginView", () => {
  beforeEach(() => {
    navigation.params = new URLSearchParams();
  });

  it("has a heading, labelled fields with sign-in autocomplete, and links", () => {
    const markup = render();

    expect(markup).toMatch(/<h1[^>]*>Welcome back<\/h1>/);
    expect(markup).toContain('aria-label="Sign in"');
    expect(markup).toMatch(/<label[^>]*for="login-email"/);
    expect(markup).toMatch(/<label[^>]*for="login-password"/);
    expect(markup).toMatch(/id="login-email"[^>]*type="email"[^>]*autoComplete="email"/);
    const passwordTag = markup.match(/<input[^>]*id="login-password"[^>]*>/)?.[0];
    expect(passwordTag).toContain('type="password"');
    expect(passwordTag).toContain('autoComplete="current-password"');
    expect(markup).toContain('href="/auth/register"');
    expect(markup).toMatch(/<a[^>]*href="\/auth\/forgot-password"[^>]*>Forgot your password\?<\/a>/);
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*>Sign in<\/button>/);
  });

  it("lets the password be shown, with an accessible toggle", () => {
    expect(render()).toMatch(
      /<button[^>]*type="button"[^>]*aria-label="Show password"/,
    );
  });

  it("explains an expired session once, politely", () => {
    const markup = render(
      "?reason=session-expired&redirect=%2Fdashboards%2Fcontracts",
    );
    expect(markup).toContain("Your session has expired.");
    expect(markup).toMatch(/role="status"[^>]*>[\s\S]*Your session has expired/);
    expect(markup).not.toContain("Sign in to continue to that page.");
  });

  it("asks to sign in to continue when sent from a protected page", () => {
    const markup = render("?redirect=%2Fdashboards");
    expect(markup).toContain("Sign in to continue to that page.");
    expect(markup).not.toContain("Your session has expired.");
  });

  it("shows neither notice on a plain visit", () => {
    const markup = render();
    expect(markup).not.toContain("Your session has expired.");
    expect(markup).not.toContain("Sign in to continue to that page.");
  });
});
