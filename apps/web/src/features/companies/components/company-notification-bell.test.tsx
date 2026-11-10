import { renderToStaticMarkup } from "react-dom/server";
import {
  cloneElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
  ECountryCode,
  ECurrencyCode,
  EContractStatus,
  EPartyType,
} from "@contractflow/contracts-schema";
import type {
  ICompanyAccessResponse,
  ICompanyDashboardContract,
  IncomingContractInvitation,
} from "@contractflow/contracts-schema";
import {
  buildCompanyNotifications,
  CompanyNotificationBell,
} from "./company-notification-bell";

const mocks = vi.hoisted(() => ({
  invitations: vi.fn(),
  dashboard: vi.fn(),
}));

vi.mock("@/services/contractApi", () => ({
  useGetIncomingContractInvitationsQuery: mocks.invitations,
}));
vi.mock("@/services/companiesApi", () => ({
  useGetCompanyDashboardQuery: mocks.dashboard,
}));
vi.mock("@/hooks/use-user-time-zone", () => ({
  useUserTimeZone: () => "UTC",
}));

// The real menu renders its items in a portal only while open; render them
// inline so the content can be checked.
vi.mock("@workspace/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  DropdownMenuLinkItem: ({
    render,
    children,
  }: {
    render: ReactElement<{ role?: string }>;
    children: ReactNode;
  }) => cloneElement(render, { role: "menuitem" }, children),
}));

const invitation: IncomingContractInvitation = {
  id: "inv-1",
  contractTitle: "Pipeline inspection",
  contractReference: "CTR-009",
  invitingCompanyName: "Delta Energy",
  partyType: EPartyType.CONTRACTOR,
  email: "office@acme.example",
  createdAt: "2026-11-01T00:00:00.000Z",
  expiresAt: "2026-11-20T00:00:00.000Z",
};

const expiring: ICompanyDashboardContract = {
  id: "contract-1",
  referenceNumber: "CTR-001",
  title: "Site services agreement",
  status: EContractStatus.ACTIVE,
  endDate: "2026-11-15",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

function accessFor(
  canManageCompany: boolean,
  verifiedAt: Date | null = new Date("2026-01-01T00:00:00Z"),
): ICompanyAccessResponse {
  return {
    company: {
      id: "company-1",
      name: "Acme Works",
      legalName: "Acme Works Limited",
      registrationNumber: "",
      taxIdentificationNumber: "",
      email: "office@acme.example",
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
      verifiedAt,
    },
    membership: {
      id: "membership-1",
      companyId: "company-1",
      companyRole: canManageCompany
        ? ECompanyRole.COMPANY_ADMIN
        : ECompanyRole.HSE_OFFICER,
      status: ECompanyUserStatus.ACTIVE,
      canManageCompany,
    },
  };
}

describe("buildCompanyNotifications", () => {
  const now = new Date("2026-11-10T12:00:00Z");

  it("lists invitations, then email verification, then contracts ending soon", () => {
    const items = buildCompanyNotifications({
      company: { email: "office@acme.example", verifiedAt: null },
      invitations: [invitation],
      expiringContracts: [expiring],
      timeZone: "UTC",
      now,
    });

    expect(items.map((item) => item.kind)).toEqual([
      "invitation",
      "verification",
      "expiring",
    ]);
    expect(items[0]).toMatchObject({
      title: "Delta Energy invited you to CTR-009",
      href: "/dashboards#contract-invitations",
    });
    expect(items[0].detail).toContain("Pipeline inspection");
    expect(items[0].detail).toMatch(/expires .*2026/);
    expect(items[1]).toMatchObject({
      title: "Verify your company email",
      href: "/dashboards/profile",
    });
    expect(items[1].detail).toContain("office@acme.example");
    expect(items[2]).toMatchObject({
      title: "CTR-001 ends in 5 days",
      detail: "Site services agreement",
      href: "/dashboards/contracts/contract-1",
    });
  });

  it("is empty when nothing needs attention", () => {
    expect(
      buildCompanyNotifications({
        company: { email: "office@acme.example", verifiedAt: new Date() },
        invitations: [],
        expiringContracts: [],
        now,
      }),
    ).toEqual([]);
  });

  it("words contracts ending today and tomorrow plainly", () => {
    const titles = buildCompanyNotifications({
      company: { email: "office@acme.example", verifiedAt: new Date() },
      invitations: [],
      expiringContracts: [
        { ...expiring, id: "a", endDate: "2026-11-10" },
        { ...expiring, id: "b", endDate: "2026-11-11" },
      ],
      now,
    }).map((item) => item.title);

    expect(titles).toEqual(["CTR-001 ends today", "CTR-001 ends tomorrow"]);
  });
});

describe("CompanyNotificationBell", () => {
  beforeEach(() => {
    mocks.invitations.mockReset().mockReturnValue({
      currentData: [invitation],
      error: undefined,
    });
    mocks.dashboard.mockReset().mockReturnValue({
      currentData: { expiringContracts: [expiring] },
      error: undefined,
    });
  });

  it("shows the count on the bell and links each notification", () => {
    const markup = renderToStaticMarkup(
      <CompanyNotificationBell access={accessFor(true, null)} />,
    );

    expect(markup).toContain('aria-label="Notifications, 3 need attention"');
    expect(markup).toMatch(/aria-hidden="true"[^>]*>3<\/span>/);
    expect(markup).toMatch(
      /<a[^>]*href="\/dashboards#contract-invitations"[^>]*role="menuitem"|role="menuitem"[^>]*href="\/dashboards#contract-invitations"/,
    );
    expect(markup).toContain('href="/dashboards/profile"');
    expect(markup).toContain('href="/dashboards/contracts/contract-1"');
  });

  it("only asks the API for admin-only data when the user is an administrator", () => {
    const markup = renderToStaticMarkup(
      <CompanyNotificationBell access={accessFor(false, null)} />,
    );

    expect(mocks.invitations).toHaveBeenCalledWith(
      { companyId: "company-1" },
      expect.objectContaining({ skip: true }),
    );
    expect(mocks.dashboard).toHaveBeenCalledWith(
      { companyId: "company-1" },
      expect.objectContaining({ skip: true }),
    );
    expect(markup).toContain('aria-label="Notifications"');
    expect(markup).toContain("You&#x27;re all caught up.");
  });

  it("says when notifications could not be loaded instead of claiming none", () => {
    mocks.invitations.mockReturnValue({
      currentData: undefined,
      error: { status: 500 },
    });
    mocks.dashboard.mockReturnValue({
      currentData: undefined,
      error: undefined,
    });

    const markup = renderToStaticMarkup(
      <CompanyNotificationBell access={accessFor(true)} />,
    );

    expect(markup).toContain("Notifications could not be loaded.");
    expect(markup).not.toContain("all caught up");
  });
});
