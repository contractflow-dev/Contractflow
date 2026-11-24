// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { RiFileList3Line } from "@remixicon/react";
import { CompanyAdminShell } from "./CompanyAdminShell";

window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

const mocks = vi.hoisted(() => ({
  pathname: "/dashboards/contracts/c-1/parties",
  replace: vi.fn(),
  dispatch: vi.fn(),
  activeCompanyId: "company-1",
  boundary: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/store/hooks", () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: () => mocks.activeCompanyId,
}));
vi.mock("@/services/authApi", () => ({
  useGetCurrentUserQuery: () => ({ data: { id: "user-1" } }),
}));
vi.mock("@/services/companiesApi", () => ({
  useGetCompaniesQuery: () => ({
    currentData: ["company-1", "company-2"].map((id) => ({
      company: { id, name: `Name ${id}`, status: "active" },
      membership: { companyId: id, status: "active", canManageCompany: true },
    })),
    error: undefined,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useGetCompanyAccessSummaryQuery: () => ({}),
}));
vi.mock("@/components/theme/theme-toggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/account-menu/account-menu", () => ({
  AccountMenu: () => null,
}));
vi.mock("./components/company-notification-bell", () => ({
  CompanyNotificationBell: () => null,
}));
vi.mock("@/features/contracts/components/contract-shell-navigation", () => ({
  ContractBreadcrumbs: () => <p>Contract trail</p>,
  ContractNavigationBoundary: ({
    contractId,
    companyId,
    children,
  }: {
    contractId: string;
    companyId: string;
    children: (navigation: unknown) => ReactNode;
  }) => {
    mocks.boundary({ contractId, companyId });
    return children({
      crumbs: [{ label: "CTR-1" }],
      module: {
        href: `/dashboards/contracts/${contractId}`,
        label: "Contract",
        icon: RiFileList3Line,
        back: { href: "/dashboards/contracts", label: "All contracts" },
        heading: <p>Open contract identity</p>,
        pageGroups: [
          {
            label: "Contract",
            items: [
              {
                href: `/dashboards/contracts/${contractId}/parties`,
                label: "Parties",
                icon: RiFileList3Line,
              },
            ],
          },
        ],
      },
    });
  },
}));

beforeEach(() => {
  mocks.pathname = "/dashboards/contracts/c-1/parties";
  mocks.replace.mockClear();
  mocks.dispatch.mockClear();
  mocks.boundary.mockClear();
});
afterEach(cleanup);

const shell = () =>
  render(<CompanyAdminShell>{() => <p>Page</p>}</CompanyAdminShell>);

describe("CompanyAdminShell contract context", () => {
  it("shows the contract's navigation on a contract route", () => {
    shell();
    expect(mocks.boundary).toHaveBeenCalledWith({
      contractId: "c-1",
      companyId: "company-1",
    });
    const pages = screen.getByRole("navigation", { name: "Contract pages" });
    expect(pages.textContent).toContain("Open contract identity");
    expect(pages.textContent).toContain("All contracts");
    expect(
      screen
        .getByRole("link", { name: "Parties" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.getByText("Contract trail")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "All Contracts" })).toBeNull();
  });

  it("shows the company's navigation on the register", () => {
    mocks.pathname = "/dashboards/contracts";
    shell();
    expect(mocks.boundary).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("navigation", { name: "Contract pages" }),
    ).toBeNull();
    expect(screen.getByRole("link", { name: "All Contracts" })).toBeTruthy();
  });

  it("shows Company Settings in the sidebar, with the company profile", () => {
    mocks.pathname = "/dashboards/profile";
    shell();
    expect(mocks.boundary).not.toHaveBeenCalled();
    const pages = screen.getByRole("navigation", { name: "Settings pages" });
    expect(
      within(pages)
        .getByRole("link", { name: "Company Profile" })
        .getAttribute("aria-current"),
    ).toBe("page");
    // Personal settings live in the account menu, not in Company Settings.
    expect(within(pages).queryByText("Personal Profile")).toBeNull();
  });

  it("leaves the contract when the company changes", () => {
    shell();
    fireEvent.change(screen.getAllByLabelText("Select company")[0], {
      target: { value: "company-2" },
    });
    expect(mocks.replace).toHaveBeenCalledWith("/dashboards/contracts");
  });

  it("stays on a company page when the company changes", () => {
    mocks.pathname = "/dashboards/documents";
    shell();
    fireEvent.change(screen.getAllByLabelText("Select company")[0], {
      target: { value: "company-2" },
    });
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
