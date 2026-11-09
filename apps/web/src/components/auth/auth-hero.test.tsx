import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthHero } from "./auth-hero";

describe("AuthHero", () => {
  it("renders the shared panel with the brand, message and highlights", () => {
    const markup = renderToStaticMarkup(<AuthHero />);

    expect(markup).toContain("<aside");
    expect(markup).toContain("ContractFlow");
    expect(markup).toContain(
      "Every contract, from tender to close-out, in one place.",
    );
    expect(markup).toContain('aria-label="ContractFlow highlights"');
    // Hidden below lg, where the form takes the full width.
    expect(markup).toMatch(/class="[^"]*\bhidden\b[^"]*\blg:flex\b/);
  });

  it("uses the hero tokens, never raw black or white, so both themes match", () => {
    const markup = renderToStaticMarkup(<AuthHero />);

    expect(markup).toContain("bg-hero-overlay");
    expect(markup).toContain("text-hero-foreground");
    expect(markup).not.toMatch(/bg-black|text-white/);
  });

  it("switches only the photo between variants", () => {
    expect(renderToStaticMarkup(<AuthHero />)).toContain("bg-auth-hero");
    const register = renderToStaticMarkup(<AuthHero image="register" />);
    expect(register).toContain("bg-reg-hero");
    expect(register).not.toContain("bg-auth-hero");
  });

  it.each([
    "../../features/auth/_views/login-view.tsx",
    "../../features/auth/_views/register-view.tsx",
    "../../features/auth/_views/verification-pending-view.tsx",
    "../../features/auth/_views/verify-email-view.tsx",
    "../../features/onboarding/_views/onboarding-view.tsx",
  ])("is the only hero implementation used by %s", (path) => {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");

    expect(source).toContain("<AuthHero");
    expect(source).not.toMatch(/bg-(auth|reg)-hero|<aside/);
  });
});
