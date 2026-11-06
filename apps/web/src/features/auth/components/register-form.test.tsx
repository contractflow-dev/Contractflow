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
});
