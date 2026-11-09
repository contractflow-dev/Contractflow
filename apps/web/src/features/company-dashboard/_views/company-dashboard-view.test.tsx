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
import { CompanyDashboardView, greeting } from "./company-dashboard-view";

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

// Covered by its own tests; here it only needs to stay out of the way.
vi.mock(
  "@/features/contracts/components/incoming-contract-invitations",
  () => ({
    IncomingContractInvitations: () => null,
  }),
);

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
  portfolioHealth: {
    stalledAfterDays: 14,
    stalledContractCount: 2,
    nonCompliantContractorCount: 1,
    overduePaymentCount: 3,
  },
  departments: {
    complianceAttentionCount: 4,
    contractsNeedingAttentionCount: 5,
    openIncidentCount: 6,
    invoicesDueSoonCount: 7,
    dueWindowDays: 30,
  },
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

const loaded = (currentData: ICompanyDashboardResponse | undefined) => ({
  currentData,
  error: undefined,
  isLoading: false,
  isFetching: false,
  refetch: vi.fn(),
});

describe("CompanyDashboardView", () => {
  beforeEach(() => {
    mocks.verifiedAt = new Date("2026-01-01T00:00:00Z");
    mocks.getDashboard.mockReturnValue(loaded(dashboard));
    mocks.getCurrentUser.mockReturnValue({
      data: { firstName: "Ari", lastName: "Admin" },
    });
  });

  const render = () => renderToStaticMarkup(<CompanyDashboardView />);
  const withData = (overrides: Partial<ICompanyDashboardResponse>) =>
    mocks.getDashboard.mockReturnValue(loaded({ ...dashboard, ...overrides }));

  it("asks an administrator to verify an unverified company email", () => {
    mocks.verifiedAt = null;

    const markup = render();

    expect(markup).toContain("Verify your company email");
    expect(markup).toContain("office@acme.example");
    expect(markup).toContain("Send a new link");
  });

  it("hides the verification notice once the company email is verified", () => {
    expect(render()).not.toContain("Verify your company email");
  });

  it("greets the administrator by first name, under one page heading", () => {
    const markup = render();

    expect(markup).toMatch(
      /<h1[^>]*>Good (morning|afternoon|evening), Ari<\/h1>/,
    );
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain("Here’s where your contracts stand today.");
  });

  it("shows portfolio health and department figures from the API", () => {
    const markup = render();

    expect(markup).toContain(">Portfolio health</h2>");
    for (const [value, label] of [
      ["1", "Active contracts"],
      ["2", "Stalled contracts"],
      ["1", "Non-compliant contractors"],
      ["3", "Payments overdue"],
    ]) {
      expect(markup).toMatch(new RegExp(`>${value}</p><p[^>]*>${label}</p>`));
    }
    expect(markup).toContain("no recorded change in 14+ days");

    expect(markup).toContain(">Department workspaces</h2>");
    for (const [value, label] of [
      ["4", "Compliance records needing attention"],
      ["5", "Contracts needing attention"],
      ["6", "Open incidents"],
      ["7", "Invoices due in the next 30 days"],
    ]) {
      expect(markup).toMatch(new RegExp(`>${value}</p><p[^>]*>${label}</p>`));
    }
    // Workspaces aren't built yet: they say so and link nowhere.
    expect(markup.match(/Workspace planned/g)).toHaveLength(4);
    expect(markup).not.toContain('href="#planned');
  });

  it("offers real quick actions and marks stage configuration as planned", () => {
    const markup = render();

    expect(markup).toMatch(
      /href="\/dashboards\/contracts#new-contract"[^>]*>Create a contract<\/a>/,
    );
    expect(markup).toContain('href="/dashboards/team"');
    expect(markup).toContain("1 member, 0 pending invitations.");
    expect(markup).toContain("Configure contract stages");
    expect(markup).toMatch(/>Planned<\/span>/);
  });

  it("flips the KPI, department and quick-action cards to the other theme on hover", () => {
    const markup = render();
    // 4 portfolio KPIs, 4 department cards and all 3 quick actions, which
    // now look alike: none of them is dark at rest.
    expect(markup.match(/data-highlight="true"/g)).toHaveLength(11);
    expect(markup).not.toContain("bg-navy");
  });

  it("lists recent activity and contracts ending soon from real data", () => {
    const markup = render();

    expect(markup).toContain(">Recent activity</h2>");
    expect(markup).toContain("Equipment supply");
    expect(markup).toContain("CTR-002 · End date: Date not available");
    expect(markup).toContain(">Contracts ending soon</h2>");
    expect(markup).toContain("Site services agreement");
    expect(markup).toContain('href="/dashboards/contracts/contract-1"');
    expect(markup).toContain("ending in the next 30 days");
  });

  it("welcomes a first-time owner with a no-contracts state", () => {
    withData({
      summary: {
        ...dashboard.summary,
        totalContractCount: 0,
        activeContractCount: 0,
        expiringContractCount: 0,
      },
      expiringContracts: [],
      recentlyUpdatedContracts: [],
    });

    const markup = render();

    expect(markup).toContain("Welcome to your ContractFlow workspace.");
    expect(markup).toContain(">No contracts yet</h3>");
    expect(markup).toContain(">Invite your team</a>");
    expect(markup).not.toContain(">Contracts ending soon</h2>");
  });

  it("shows explicit empty states instead of invented contract rows", () => {
    withData({
      summary: {
        ...dashboard.summary,
        activeContractCount: 0,
        expiringContractCount: 0,
      },
      expiringContracts: [],
      recentlyUpdatedContracts: [],
    });

    const markup = render();

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
    const loadingMarkup = render();
    expect(loadingMarkup).toContain("Loading company dashboard");
    expect(loadingMarkup).not.toContain("Site services agreement");

    mocks.getDashboard.mockReturnValue({
      currentData: undefined,
      error: { status: 500, data: { message: "Unavailable" } },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    const errorMarkup = render();
    expect(errorMarkup).toContain("Dashboard data could not be loaded");
    expect(errorMarkup).toContain("Retry");
    expect(errorMarkup).not.toContain("Site services agreement");
  });

  it("uses the configured expiry window for the ending-soon copy", () => {
    withData({
      expiryWindowDays: 45,
      summary: { ...dashboard.summary, activeContractCount: 2 },
      expiringContracts: [],
      recentlyUpdatedContracts: [],
    });

    const markup = render();

    expect(markup).toContain("ending in the next 45 days");
    expect(markup).toContain(
      "No active contracts end within the next 45 days.",
    );
  });
});

describe("greeting", () => {
  it("follows the time of day in the user's time zone", () => {
    expect(greeting("UTC", new Date("2026-11-09T09:30:00Z"))).toBe(
      "Good morning",
    );
    // Lagos is UTC+1: 13:00 UTC is 14:00 there, and 17:30 UTC is 18:30.
    expect(greeting("Africa/Lagos", new Date("2026-11-09T13:00:00Z"))).toBe(
      "Good afternoon",
    );
    expect(greeting("Africa/Lagos", new Date("2026-11-09T17:30:00Z"))).toBe(
      "Good evening",
    );
  });
});
