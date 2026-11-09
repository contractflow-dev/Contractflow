import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RegisterForm } from "./register-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/services/authApi", () => ({
  useRegisterMutation: () => [vi.fn(), { isLoading: false }],
}));

describe("RegisterForm", () => {
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
