import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminHeader } from "./admin-header";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  getCurrentUser: vi.fn(),
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
  useGetCurrentUserQuery: mocks.getCurrentUser,
  useLogoutMutation: () => [mocks.logout, { isLoading: mocks.isLoading }],
}));

vi.mock("@/components/theme/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

describe("AdminHeader", () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReturnValue({ data: undefined });
    mocks.isLoading = false;
  });

  it("makes sign out available in the shared dashboard header", () => {
    const markup = renderToStaticMarkup(
      <AdminHeader onToggleMobileNav={vi.fn()} />,
    );

    expect(markup).toContain('aria-label="Sign out of ContractFlow"');
    expect(markup).toContain("Sign out");
  });
});
