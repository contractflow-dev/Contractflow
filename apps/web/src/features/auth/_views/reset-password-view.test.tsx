import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { metadata } from "@/app/auth/reset-password/page";
import { ResetPasswordView } from "./reset-password-view";

const navigation = vi.hoisted(() => ({ params: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.params,
}));
vi.mock("@/services/authApi", () => ({
  useResetPasswordMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock("@/components/auth/auth-hero", () => ({ AuthHero: () => null }));
vi.mock("@/components/auth/authTopBar", () => ({ AuthTopBar: () => null }));

function render(search: string) {
  navigation.params = new URLSearchParams(search);
  return renderToStaticMarkup(<ResetPasswordView />);
}

describe("ResetPasswordView", () => {
  it("asks for the new password twice, with the rules and visibility toggles", () => {
    const markup = render("?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG");

    expect(markup).toMatch(/<h1[^>]*>Choose a new password<\/h1>/);
    expect(markup).toMatch(/<label[^>]*for="reset-password"[^>]*>New password/);
    expect(markup).toMatch(/<label[^>]*for="reset-confirm-password"[^>]*>Confirm new password/);
    expect(markup.match(/autoComplete="new-password"/g)).toHaveLength(2);
    expect(markup.match(/aria-label="Show password"/g)).toHaveLength(2);
    expect(markup).toContain("12–255 characters");
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*>Reset password<\/button>/);
    expect(markup).toContain('href="/login"');
  });

  it("never puts the token into the page", () => {
    const token = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
    expect(render(`?token=${token}`)).not.toContain(token);
  });

  it("explains a link without a token and offers a new one", () => {
    const markup = render("");

    expect(markup).toMatch(/<h1[^>]*>Reset link is incomplete<\/h1>/);
    expect(markup).toContain('href="/auth/forgot-password"');
    expect(markup).not.toContain("<form");
  });

  it("tells the browser not to send this page's address to other sites", () => {
    expect(metadata.referrer).toBe("no-referrer");
  });
});
