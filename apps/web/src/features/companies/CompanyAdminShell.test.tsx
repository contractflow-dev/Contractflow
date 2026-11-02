import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyAdminShell } from "./CompanyAdminShell";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  getCompanies: vi.fn(),
  getCurrentUser: vi.fn(),
  logout: vi.fn(),
  pathname: "/dashboards/contracts",
  search: "",
  activeCompanyId: "company-1",
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => ({
    toString: () => mocks.search,
  }),
}));

vi.mock("@/store/hooks", () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: () => mocks.activeCompanyId,
}));

vi.mock("@/features/workspace/workspaceSlice", () => ({
  selectActiveWorkspaceId: vi.fn(),
  setActiveWorkspaceId: vi.fn((companyId: string) => ({
    type: "workspace/setActiveWorkspaceId",
    payload: companyId,
  })),
}));

vi.mock("@/services/companiesApi", () => ({
  useGetCompaniesQuery: mocks.getCompanies,
}));

vi.mock("@/services/authApi", () => ({
  useGetCurrentUserQuery: mocks.getCurrentUser,
  useLogoutMutation: () => [mocks.logout, { isLoading: false }],
}));

vi.mock("@/components/theme/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

vi.mock("@workspace/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => (
    <div data-menu-group>{children}</div>
  ),
  DropdownMenuItem: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

const companies = [
  {
    company: { id: "company-1", name: "Acme Works", status: "active" },
    membership: {
      companyId: "company-1",
      status: "active",
      canManageCompany: true,
    },
  },
  {
    company: { id: "company-2", name: "Northstar Build", status: "active" },
    membership: {
      companyId: "company-2",
      status: "active",
      canManageCompany: false,
    },
  },
];

describe("CompanyAdminShell", () => {
  beforeEach(() => {
    mocks.pathname = "/dashboards/contracts";
    mocks.search = "";
    mocks.activeCompanyId = "company-1";
    mocks.dispatch.mockClear();
    mocks.replace.mockClear();
    mocks.getCompanies.mockReturnValue({
      currentData: companies,
      error: undefined,
      isFetching: false,
      refetch: vi.fn(),
    });
    mocks.getCurrentUser.mockReturnValue({
      data: {
        id: "user-1",
        firstName: "Ari",
        lastName: "Admin",
        email: "ari@example.com",
      },
    });
  });

  it("shows clean navigation URLs and uses the active company from state", () => {
    mocks.activeCompanyId = "company-2";

    const markup = renderToStaticMarkup(
      <CompanyAdminShell>
        {(access) => <p>Content for {access.company.name}</p>}
      </CompanyAdminShell>,
    );

    expect(markup).toContain("Content for Northstar Build");
    expect(markup).toContain('href="/dashboards/contracts"');
    expect(markup).not.toContain("companyId=");
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain(">Contracts</a>");
    expect(markup).toContain("Ari Admin");
    expect(markup).toContain("Open account menu");
    expect(markup).toContain("data-menu-group");
    expect(markup).toContain('aria-label="Sign out of ContractFlow"');
    expect(markup).toContain(">Sign out</button>");
    expect(markup).not.toContain(">Overview</a>");
    expect(markup).not.toContain(">Team</a>");
    expect(markup).not.toContain(">Company profile</a>");
  });

  it("denies company-admin routes to a regular company member", () => {
    mocks.pathname = "/dashboards/profile";
    mocks.activeCompanyId = "company-2";

    const markup = renderToStaticMarkup(
      <CompanyAdminShell>
        {() => <p>Protected profile content</p>}
      </CompanyAdminShell>,
    );

    expect(markup).toContain("Company administrator access required");
    expect(markup).not.toContain("Protected profile content");
    expect(markup).toContain(">Contracts</a>");
    expect(markup).not.toContain(">Team</a>");
    expect(markup).not.toContain(">Company profile</a>");
  });

  it("does not render scoped content until an invalid active company is resolved", () => {
    mocks.activeCompanyId = "suspended-company";

    const markup = renderToStaticMarkup(
      <CompanyAdminShell>
        {() => <p>Company-scoped content</p>}
      </CompanyAdminShell>,
    );

    expect(markup).toContain("Loading your company workspace");
    expect(markup).not.toContain("Company-scoped content");
  });

  it("shows a loading state while company access is unresolved", () => {
    mocks.getCompanies.mockReturnValue({
      currentData: undefined,
      error: undefined,
      isFetching: true,
      refetch: vi.fn(),
    });

    const markup = renderToStaticMarkup(
      <CompanyAdminShell>{() => <p>Company content</p>}</CompanyAdminShell>,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Loading your companies");
    expect(markup).not.toContain("Company content");
  });

  it("shows an explicit error state when company access cannot be loaded", () => {
    mocks.getCompanies.mockReturnValue({
      currentData: undefined,
      error: { status: 500, data: { message: "Unavailable" } },
      isFetching: false,
      refetch: vi.fn(),
    });

    const markup = renderToStaticMarkup(
      <CompanyAdminShell>{() => <p>Company content</p>}</CompanyAdminShell>,
    );

    expect(markup).toContain("Unable to load companies");
    expect(markup).toContain("Retry");
    expect(markup).not.toContain("Company content");
  });

  it("offers onboarding when the user has no active company memberships", () => {
    mocks.getCompanies.mockReturnValue({
      currentData: [],
      error: undefined,
      isFetching: false,
      refetch: vi.fn(),
    });

    const markup = renderToStaticMarkup(
      <CompanyAdminShell>{() => <p>Company content</p>}</CompanyAdminShell>,
    );

    expect(markup).toContain("No active company");
    expect(markup).toContain('href="/onboarding"');
    expect(markup).not.toContain("Company content");
  });
});
