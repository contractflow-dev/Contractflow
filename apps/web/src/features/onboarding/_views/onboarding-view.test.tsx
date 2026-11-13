import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingView, companySetupSteps } from "./onboarding-view";

const accessSummary = vi.hoisted(() => ({
  current: undefined as { pendingInvitationCount: number } | undefined,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/services/authApi", () => ({
  useGetCurrentUserQuery: () => ({
    data: { id: "u-1", email: "ada@example.com", emailVerifiedAt: "2026-01-01" },
    isLoading: false,
    error: undefined,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/features/companies", () => ({
  useCreateCompanyMutation: () => [vi.fn(), { isLoading: false }],
  useGetCompanyAccessSummaryQuery: () => ({ data: accessSummary.current }),
}));
vi.mock("@/store/hooks", () => ({ useAppDispatch: () => vi.fn() }));
vi.mock("@/components/auth/auth-hero", () => ({
  AuthHero: () => <aside>HERO</aside>,
}));
vi.mock("@/components/auth/authTopBar", () => ({ AuthTopBar: () => null }));
vi.mock("@/components/auth/sign-out-action", () => ({
  SignOutAction: () => <button type="button">SIGN OUT</button>,
}));

describe("OnboardingView", () => {
  it("starts on the first of three steps, beside the hero panel", () => {
    const markup = renderToStaticMarkup(<OnboardingView />);

    expect(markup).toMatch(/<h1[^>]*>Create your company<\/h1>/);
    expect(markup).toMatch(
      /<h2[^>]*tabindex="-1"[^>]*>Step 1 of 3: Company and legal details<\/h2>/,
    );
    const steps = markup.match(/<li[^>]*>[\s\S]*?<\/li>/g) ?? [];
    expect(steps).toHaveLength(3);
    expect(steps[0]).toContain('aria-current="step"');
    // Like sign-in and sign-up, the form sits in a section beside the hero.
    expect(markup).toMatch(/<section[^>]*>[\s\S]*Create your company/);
    expect(markup).toContain("HERO");
  });

  it("shows only the first step's fields, all labelled", () => {
    const markup = renderToStaticMarkup(<OnboardingView />);

    for (const id of ["name", "legalName"]) {
      expect(markup).toMatch(new RegExp(`<label[^>]*for="${id}"`));
      expect(markup).toMatch(new RegExp(`id="${id}"[^>]*aria-required="true"`));
    }
    // Registration and tax numbers are optional, here and in the API.
    for (const id of ["registrationNumber", "taxIdentificationNumber"]) {
      expect(markup).toMatch(
        new RegExp(`<label[^>]*for="${id}"[^>]*>[^<]*<span data-slot="optional-indicator"`),
      );
      expect(markup).not.toMatch(new RegExp(`id="${id}"[^>]*aria-required`));
    }
    expect(markup).not.toContain('id="email"');
    expect(markup).not.toContain('id="countryCode"');
  });

  it("tells invited people they don't need to create a company", () => {
    const markup = renderToStaticMarkup(<OnboardingView />);

    expect(markup).toContain("Were you invited to join a company?");
    expect(markup).toContain("ada@example.com");
  });

  describe("with a pending invitation", () => {
    afterEach(() => {
      accessSummary.current = undefined;
    });

    it("points to the invitation instead of company setup", () => {
      accessSummary.current = { pendingInvitationCount: 1 };

      const markup = renderToStaticMarkup(<OnboardingView />);

      expect(markup).toContain("You have a company invitation.");
      expect(markup).toMatch(
        /<a[^>]*href="\/invitations"[^>]*>Review your invitations<\/a>/,
      );
      expect(markup).not.toContain("Were you invited to join a company?");
    });

    it("counts several invitations", () => {
      accessSummary.current = { pendingInvitationCount: 2 };

      expect(renderToStaticMarkup(<OnboardingView />)).toContain(
        "You have 2 company invitations.",
      );
    });
  });

  it("moves on with a submit button, and signs out for real", () => {
    const markup = renderToStaticMarkup(<OnboardingView />);

    expect(markup).toMatch(
      /<button[^>]*type="submit"[^>]*>Next: Contact<\/button>/,
    );
    expect(markup.match(/type="submit"/g)).toHaveLength(1);
    expect(markup).not.toContain(">Back<");
    expect(markup).toContain("SIGN OUT");
    // The old link went to /login without signing out.
    expect(markup).not.toContain("Sign out and return to sign in");
  });

  it("puts every field in exactly one step", () => {
    const fields = companySetupSteps.flatMap((step) => step.fields);
    expect(new Set(fields).size).toBe(fields.length);
    expect([...fields].sort()).toEqual(
      [
        "name",
        "legalName",
        "registrationNumber",
        "taxIdentificationNumber",
        "email",
        "phoneNumber",
        "website",
        "addressLine1",
        "addressLine2",
        "city",
        "stateRegion",
        "postalCode",
        "countryCode",
        "defaultCurrencyCode",
      ].sort(),
    );
  });
});
