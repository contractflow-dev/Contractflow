import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyAdminShell } from "./CompanyAdminShell";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  getCompanies: vi.fn(),
  getAccessSummary: vi.fn(),
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
  useGetCompanyAccessSummaryQuery: mocks.getAccessSummary,
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
    mocks.getAccessSummary.mockReturnValue({
      currentData: undefined,
      error: undefined,
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

  function renderWithoutCompanies(summary: {
    currentData?: {
      activeCompanyCount: number;
      hasEndedMembership: boolean;
      hasInactiveCompanyMembership: boolean;
    };
    error?: unknown;
  }) {
    mocks.getCompanies.mockReturnValue({
      currentData: [],
      error: undefined,
      isFetching: false,
      refetch: vi.fn(),
    });
    mocks.getAccessSummary.mockReturnValue({ refetch: vi.fn(), ...summary });
    return renderToStaticMarkup(
      <CompanyAdminShell>{() => <p>Company content</p>}</CompanyAdminShell>,
    );
  }

  const noAccess = {
    activeCompanyCount: 0,
    hasEndedMembership: false,
    hasInactiveCompanyMembership: false,
  };

  it("offers onboarding to a user who has never had a company", () => {
    const markup = renderWithoutCompanies({ currentData: noAccess });

    expect(markup).toContain("Set up your company");
    expect(markup).toContain('href="/onboarding"');
    expect(markup).not.toContain("Company content");
  });

  it("asks for the access summary only when there is no usable company", () => {
    renderWithoutCompanies({ currentData: noAccess });
    expect(mocks.getAccessSummary).toHaveBeenLastCalledWith(undefined, {
      skip: false,
    });

    mocks.getAccessSummary.mockClear();
    mocks.getCompanies.mockReturnValue({
      currentData: companies,
      error: undefined,
      isFetching: false,
      refetch: vi.fn(),
    });
    renderToStaticMarkup(
      <CompanyAdminShell>{() => <p>Company content</p>}</CompanyAdminShell>,
    );
    expect(mocks.getAccessSummary).toHaveBeenLastCalledWith(undefined, {
      skip: true,
    });
  });

  it("explains ended access instead of treating a removed member as new", () => {
    const markup = renderWithoutCompanies({
      currentData: { ...noAccess, hasEndedMembership: true },
    });

    expect(markup).toContain("Your company access has ended");
    expect(markup).toContain("ask its administrator to invite you again");
    expect(markup).toContain("Create a new company instead");
    expect(markup).not.toContain("Set up your company");
  });

  it("explains an inactive company workspace", () => {
    const markup = renderWithoutCompanies({
      currentData: { ...noAccess, hasInactiveCompanyMembership: true },
    });

    expect(markup).toContain("Your company&#x27;s workspace is inactive");
    expect(markup).not.toContain("Set up your company");
  });

  it("checks access before deciding where a user without a company belongs", () => {
    const markup = renderWithoutCompanies({ currentData: undefined });

    expect(markup).toContain("Checking your company access");
    expect(markup).not.toContain("Set up your company");
  });

  it("offers a retry when the access summary cannot be loaded", () => {
    const markup = renderWithoutCompanies({
      error: { status: 500, data: { message: "Unavailable" } },
    });

    expect(markup).toContain("Unable to check your company access");
    expect(markup).toContain("Retry");
  });

  it("does not show the admin overview or an access-denied card to a member landing on it", () => {
    mocks.pathname = "/dashboards";
    mocks.activeCompanyId = "company-2";

    const markup = renderToStaticMarkup(
      <CompanyAdminShell>{() => <p>Admin overview</p>}</CompanyAdminShell>,
    );

    expect(markup).toContain("Opening your workspace");
    expect(markup).not.toContain("Admin overview");
    expect(markup).not.toContain("Company administrator access required");
  });

  it("offers the company switcher in the mobile header as well as the sidebar", () => {
    const markup = renderToStaticMarkup(
      <CompanyAdminShell>{() => <p>Company content</p>}</CompanyAdminShell>,
    );

    const switchers = markup.match(/aria-label="Select company"/g) ?? [];
    expect(switchers).toHaveLength(2);
    expect(markup).toMatch(/class="[^"]*md:hidden[^"]*"[^>]*><select[^>]*aria-label="Select company"/);
    expect(markup).toContain(">Northstar Build</option>");
  });

  it("shows only the active company name when there is nothing to switch to", () => {
    mocks.getCompanies.mockReturnValue({
      currentData: [companies[0]],
      error: undefined,
      isFetching: false,
      refetch: vi.fn(),
    });

    const markup = renderToStaticMarkup(
      <CompanyAdminShell>{() => <p>Company content</p>}</CompanyAdminShell>,
    );

    expect(markup).not.toContain('aria-label="Select company"');
    expect(markup).toContain("Acme Works");
  });

  it("renders the overview for a company administrator", () => {
    mocks.pathname = "/dashboards";

    const markup = renderToStaticMarkup(
      <CompanyAdminShell>{() => <p>Admin overview</p>}</CompanyAdminShell>,
    );

    expect(markup).toContain("Admin overview");
    expect(markup).toContain(">Overview</a>");
  });
});
