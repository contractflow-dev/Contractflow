import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "./register-form";

const mocks = vi.hoisted(() => ({
  invitationPreview: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/services/authApi", () => ({
  useRegisterMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock("@/services/companiesApi", () => ({
  useGetPublicCompanyInvitationQuery: mocks.invitationPreview,
}));

describe("RegisterForm", () => {
  beforeEach(() => {
    mocks.invitationPreview.mockReset();
    mocks.invitationPreview.mockReturnValue({
      currentData: undefined,
      isError: false,
    });
  });

  describe("for a company invitation", () => {
    const token = "invite-token";

    beforeEach(() => {
      mocks.invitationPreview.mockReturnValue({
        currentData: {
          status: "pending",
          companyName: "Acme Works",
          inviterName: "Ada Admin",
          email: "ari@example.com",
          companyRole: "Member",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
        isError: false,
      });
    });

    it("names the company and fixes the email to the invited address", () => {
      const markup = renderToStaticMarkup(
        <RegisterForm invitationToken={token} />,
      );

      expect(mocks.invitationPreview).toHaveBeenCalledWith(
        { token },
        { skip: false },
      );
      expect(markup).toContain("Join Acme Works on ContractFlow");
      expect(markup).toContain("Ada Admin invited you as Member.");
      expect(markup).toContain("You won&#x27;t need to set up a company.");
      const emailInput = markup.match(/<input[^>]*id="email"[^>]*>/)?.[0] ?? "";
      expect(emailInput).toContain('value="ari@example.com"');
      expect(emailInput).toContain("readOnly");
      expect(emailInput).toContain('aria-readonly="true"');
    });

    it("signs in back to the invitation instead of the dashboard", () => {
      const markup = renderToStaticMarkup(
        <RegisterForm invitationToken={token} />,
      );

      expect(markup).toContain(
        `href="/login?redirect=${encodeURIComponent(
          "/invitations/respond?token=invite-token",
        ).replaceAll("&", "&amp;")}"`,
      );
    });

    it("says when the invitation can no longer be used, and leaves the email editable", () => {
      mocks.invitationPreview.mockReturnValue({
        currentData: { status: "revoked" },
        isError: false,
      });

      const markup = renderToStaticMarkup(
        <RegisterForm invitationToken={token} />,
      );

      expect(markup).toContain("This invitation can&#x27;t be used any more.");
      expect(markup).toContain("Create your ContractFlow account");
      const emailInput = markup.match(/<input[^>]*id="email"[^>]*>/)?.[0] ?? "";
      expect(emailInput).not.toContain("readOnly");
    });
  });

  it("skips the invitation lookup for ordinary registration", () => {
    renderToStaticMarkup(<RegisterForm />);

    expect(mocks.invitationPreview).toHaveBeenCalledWith(
      { token: "" },
      { skip: true },
    );
  });

  it("renders the form on the server instead of an empty placeholder", () => {
    const markup = renderToStaticMarkup(<RegisterForm />);

    expect(markup).toContain("<form");
    expect(markup).toContain("Create your ContractFlow account");
    expect(markup).toContain('type="submit"');
  });

  it("groups the name fields under a legend with a visible label each", () => {
    const markup = renderToStaticMarkup(<RegisterForm />);

    expect(markup).toMatch(/<legend[^>]*>Full name<\/legend>/);
    for (const id of ["firstName", "middleName", "lastName"]) {
      expect(markup).toContain(`for="${id}"`);
      expect(markup).toContain(`id="${id}"`);
    }
    // Placeholders are no longer the only label.
    expect(markup).not.toContain('placeholder="First name"');
    expect(markup).not.toContain('aria-label="Last name"');
  });

  it("marks required and optional fields from the schema", () => {
    const markup = renderToStaticMarkup(<RegisterForm />);
    const requiredIds = [
      "firstName",
      "lastName",
      "email",
      "timezone",
      "password",
      "confirmPassword",
    ];
    for (const id of requiredIds) {
      expect(markup).toMatch(
        new RegExp(`id="${id}"[^>]*aria-required="true"|aria-required="true"[^>]*id="${id}"`),
      );
    }
    expect(markup.match(/data-slot="optional-indicator"/g)).toHaveLength(2);
    expect(markup).toContain("are required.");
  });

  it("links the password rules to the password field", () => {
    const markup = renderToStaticMarkup(<RegisterForm />);
    expect(markup).toMatch(
      /id="password"[^>]*aria-describedby="password-description"|aria-describedby="password-description"[^>]*id="password"/,
    );
    expect(markup).toContain('id="password-description"');
  });

  it("opens the terms in a dialog instead of leaving the form", () => {
    const markup = renderToStaticMarkup(<RegisterForm />);

    expect(markup).not.toContain('href="/terms-of-service"');
    expect(markup).not.toContain('href="/privacy-policy"');
    expect(markup).toMatch(/<button[^>]*type="button"[^>]*>Terms of Service<\/button>/);
    expect(markup).toMatch(/<button[^>]*type="button"[^>]*>Privacy Policy<\/button>/);
    expect(markup).toMatch(/role="checkbox"[^>]*aria-label="I agree to the Terms of Service/);
  });

  it("doesn't claim steps that don't exist", () => {
    expect(renderToStaticMarkup(<RegisterForm />)).not.toMatch(/STEP 1 OF 4/i);
  });

  it("offers password visibility on both password fields", () => {
    const markup = renderToStaticMarkup(<RegisterForm />);
    expect(markup.match(/aria-label="Show password"/g)).toHaveLength(2);
    expect(markup.match(/autoComplete="new-password"/g)).toHaveLength(2);
  });
});
