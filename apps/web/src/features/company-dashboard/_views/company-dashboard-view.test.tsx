import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
  ECountryCode,
  ECurrencyCode,
  EContractStatus,
} from "@contractflow/contracts-schema";
import type { ICompanyDashboardResponse } from "@contractflow/contracts-schema";
import { CompanyDashboardView } from "./company-dashboard-view";

const mocks = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  getCurrentUser: vi.fn(),
  verifiedAt: new Date("2026-01-01T00:00:00Z") as Date | null,
}));

vi.mock("@/features/companies/CompanyAdminShell", () => ({
  CompanyAdminShell: ({
    children,
  }: {
    children: (access: {
      company: {
        id: string;
        name: string;
        email: string;
        verifiedAt: Date | null;
      };
      membership: { canManageCompany: boolean };
    }) => ReactNode;
  }) =>
    children({
      company: {
        id: "company-1",
        name: "Acme Works",
        email: "office@acme.example",
        verifiedAt: mocks.verifiedAt,
      },
      membership: { canManageCompany: true },
    }),
}));

vi.mock("@/services/companiesApi", () => ({
  useResendCompanyVerificationEmailMutation: () => [
    vi.fn(),
    { isLoading: false },
  ],
}));

vi.mock("@/features/companies", () => ({
  useGetCompanyDashboardQuery: mocks.getDashboard,
}));

vi.mock("@/services/authApi", () => ({
  useGetCurrentUserQuery: mocks.getCurrentUser,
}));

const dashboard: ICompanyDashboardResponse = {
  company: {
    id: "company-1",
    name: "Acme Works",
    legalName: "Acme Works Limited",
    registrationNumber: "REG-1",
    taxIdentificationNumber: "TAX-1",
    email: "admin@example.com",
    phoneNumber: "+10000000000",
    website: "",
    addressLine1: "1 Test Street",
    addressLine2: "",
    city: "Test City",
    stateRegion: "Test Region",
    postalCode: "00000",
    countryCode: ECountryCode.US,
    defaultCurrencyCode: ECurrencyCode.USD,
    status: ECompanyStatus.ACTIVE,
    verifiedAt: null,
  },
  membership: {
    id: "membership-1",
    companyId: "company-1",
    companyRole: ECompanyRole.COMPANY_ADMIN,
    status: ECompanyUserStatus.ACTIVE,
    canManageCompany: true,
  },
  expiryWindowDays: 30,
  summary: {
    activeMembershipCount: 1,
    pendingInvitationCount: 0,
    totalContractCount: 2,
    activeContractCount: 1,
    expiringContractCount: 1,
  },
  expiringContracts: [
    {
      id: "contract-1",
      referenceNumber: "CTR-001",
      title: "Site services agreement",
      status: EContractStatus.ACTIVE,
      endDate: "2999-01-01",
      updatedAt: "2026-10-21T10:00:00.000Z",
    },
  ],
  recentlyUpdatedContracts: [
    {
      id: "contract-2",
      referenceNumber: "CTR-002",
      title: "Equipment supply",
      status: EContractStatus.DRAFT,
      endDate: null,
      updatedAt: "2026-10-21T10:00:00.000Z",
    },
  ],
};

describe("CompanyDashboardView", () => {
  beforeEach(() => {
    mocks.verifiedAt = new Date("2026-01-01T00:00:00Z");
    mocks.getDashboard.mockReturnValue({
      currentData: dashboard,
      error: undefined,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mocks.getCurrentUser.mockReturnValue({
      data: { firstName: "Ari", lastName: "Admin" },
    });
  });

  it("asks an administrator to verify an unverified company email", () => {
    mocks.verifiedAt = null;

    const markup = renderToStaticMarkup(<CompanyDashboardView />);

    expect(markup).toContain("Verify your company email");
    expect(markup).toContain("office@acme.example");
    expect(markup).toContain("Send a new link");
  });

  it("hides the verification notice once the company email is verified", () => {
    const markup = renderToStaticMarkup(<CompanyDashboardView />);

    expect(markup).not.toContain("Verify your company email");
  });

  it("renders real expiring and recently updated contract links", () => {
    const markup = renderToStaticMarkup(<CompanyDashboardView />);

    expect(markup).toContain("Contracts expiring soon");
    expect(markup).toContain("Site services agreement");
    expect(markup).toContain("CTR-001");
    expect(markup).toContain("Total contracts");
    expect(markup).toContain('href="/dashboards/contracts/contract-1"');
    expect(markup).toContain("Recently updated contracts");
    expect(markup).toContain("ending in the next 30 days");
    expect(markup).toContain("Equipment supply");
    expect(markup).toContain("End date: Date not available");
    expect(markup).toContain(">Manage team and invitations</a>");
    expect(markup).toContain(">Edit company profile</a>");
    // The developer-facing placeholder card for unbuilt features is gone.
    expect(markup).not.toContain("Activity and company documents");
    expect(markup).not.toContain("dashboard API");
  });

  it("shows explicit empty states instead of invented contract rows", () => {
    mocks.getDashboard.mockReturnValue({
      currentData: {
        ...dashboard,
        summary: {
          ...dashboard.summary,
          activeContractCount: 0,
          expiringContractCount: 0,
        },
        expiringContracts: [],
        recentlyUpdatedContracts: [],
      },
      error: undefined,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    const markup = renderToStaticMarkup(<CompanyDashboardView />);

    expect(markup).toContain("There are no active contracts for this company.");
    expect(markup).toContain(
      "No contracts have been updated in the last 30 days.",
    );
    expect(markup).not.toContain("CTR-001");
  });

  it("shows loading and failed-request states without contract content", () => {
    mocks.getDashboard.mockReturnValue({
      currentData: undefined,
      error: undefined,
      isLoading: true,
      isFetching: true,
      refetch: vi.fn(),
    });
    const loadingMarkup = renderToStaticMarkup(<CompanyDashboardView />);
    expect(loadingMarkup).toContain("Loading company dashboard");
    expect(loadingMarkup).not.toContain("Site services agreement");

    mocks.getDashboard.mockReturnValue({
      currentData: undefined,
      error: { status: 500, data: { message: "Unavailable" } },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    const errorMarkup = renderToStaticMarkup(<CompanyDashboardView />);
    expect(errorMarkup).toContain("Dashboard data could not be loaded");
    expect(errorMarkup).toContain("Retry");
    expect(errorMarkup).not.toContain("Site services agreement");
  });

  it("uses the configured expiry window for the overview copy", () => {
    mocks.getDashboard.mockReturnValue({
      currentData: {
        ...dashboard,
        expiryWindowDays: 45,
        summary: { ...dashboard.summary, activeContractCount: 2 },
        expiringContracts: [],
        recentlyUpdatedContracts: [],
      },
      error: undefined,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    const markup = renderToStaticMarkup(<CompanyDashboardView />);

    expect(markup).toContain("ending within 45 days");
    expect(markup).toContain(
      "No active contracts end within the next 45 days.",
    );
  });
});
