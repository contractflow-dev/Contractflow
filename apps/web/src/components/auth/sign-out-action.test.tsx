import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignOutAction } from "./sign-out-action";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  isLoading: false,
  logout: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/store/hooks", () => ({
  useAppDispatch: () => mocks.dispatch,
}));

vi.mock("@/services/authApi", () => ({
  useLogoutMutation: () => [mocks.logout, { isLoading: mocks.isLoading }],
}));

describe("SignOutAction", () => {
  beforeEach(() => {
    mocks.dispatch.mockClear();
    mocks.logout.mockReset();
    mocks.replace.mockReset();
    mocks.isLoading = false;
  });

  it("renders an accessible sign-out button", () => {
    const markup = renderToStaticMarkup(<SignOutAction />);

    expect(markup).toContain('aria-label="Sign out of ContractFlow"');
    expect(markup).toContain("Sign out");
  });

  it("disables the button and announces the pending state while signing out", () => {
    mocks.isLoading = true;

    const markup = renderToStaticMarkup(<SignOutAction />);

    expect(markup).toContain("disabled");
    expect(markup).toContain("Signing out…");
  });
});
