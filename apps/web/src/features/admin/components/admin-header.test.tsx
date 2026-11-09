import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps, ReactNode } from "react";
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

// The account menu renders its items in a portal only while open; render
// them inline so the header's sign-out action can be checked.
vi.mock("@workspace/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  DropdownMenuItem: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  DropdownMenuLinkItem: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}));

describe("AdminHeader", () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReturnValue({ data: undefined });
    mocks.isLoading = false;
  });

  it("makes sign out available in the header's account menu", () => {
    const markup = renderToStaticMarkup(<AdminHeader />);

    expect(markup).toContain('aria-label="Sign out of ContractFlow"');
    expect(markup).toContain("Sign out");
    expect(markup).toContain('aria-label="Open account menu"');
  });
});
