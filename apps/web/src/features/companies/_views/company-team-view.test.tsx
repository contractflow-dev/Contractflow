import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { headingProblems } from "@/components/page-header/heading-outline";
import { CompanyTeamView } from "./company-team-view";

const mocks = vi.hoisted(() => ({
  changeRole: vi.fn(),
  getInvitations: vi.fn(),
  getMembers: vi.fn(),
  inviteMember: vi.fn(),
  removeMember: vi.fn(),
  revokeInvitation: vi.fn(),
  resendInvitation: vi.fn(),
}));

// Covered by its own tests. It renders its own <h2> on the page.
vi.mock("../components/company-contract-roles", () => ({
  CompanyContractRoles: () => <h2>Contract roles</h2>,
}));

vi.mock("../CompanyAdminShell", () => ({
  CompanyAdminShell: ({
    children,
  }: {
    children: (access: { company: { id: string } }) => ReactNode;
  }) => children({ company: { id: "company-1" } }),
}));

vi.mock("@/features/companies", () => ({
  useChangeCompanyMemberRoleMutation: () => [
    mocks.changeRole,
    { isLoading: false },
  ],
  useGetCompanyInvitationsQuery: mocks.getInvitations,
  useGetCompanyMembersQuery: mocks.getMembers,
  useInviteCompanyMemberMutation: () => [
    mocks.inviteMember,
    { isLoading: false },
  ],
  useRemoveCompanyMemberMutation: () => [
    mocks.removeMember,
    { isLoading: false },
  ],
  useRevokeCompanyInvitationMutation: () => [
    mocks.revokeInvitation,
    { isLoading: false },
  ],
  useResendCompanyInvitationMutation: () => [
    mocks.resendInvitation,
    { isLoading: false },
  ],
}));

vi.mock("@/hooks/use-user-time-zone", () => ({
  useUserTimeZone: () => "UTC",
}));

describe("CompanyTeamView", () => {
  beforeEach(() => {
    mocks.getMembers.mockReturnValue({
      currentData: {
        data: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: 20,
          totalPages: 0,
          currentPage: 1,
        },
      },
      isFetching: false,
      error: undefined,
      isLoading: false,
    });
    mocks.getInvitations.mockReturnValue({
      currentData: {
        data: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: 10,
          totalPages: 0,
          currentPage: 1,
        },
      },
      isFetching: false,
      error: undefined,
      isLoading: false,
    });
  });

  it("collects company membership only: email, optional names and a company role", () => {
    const markup = renderToStaticMarkup(<CompanyTeamView />);

    expect(markup).toContain('id="invite-email"');
    expect(markup).toContain("First name (optional)");
    expect(markup).toContain("Last name (optional)");
    expect(markup).toContain("No invitations have been sent.");
    // Company roles only, Member first; no contract role or workspace field.
    const select = markup.slice(
      markup.indexOf('id="invite-role"'),
      markup.indexOf("</select>", markup.indexOf('id="invite-role"')),
    );
    const options = [...select.matchAll(/value="([^"]*)"/g)].map(
      ([, value]) => value,
    );
    expect(options).toEqual(["Member", "Company Administrator"]);
    expect(select).toMatch(/value="Member" selected=""/);
    for (const contractRole of [
      "Contractor Project Lead",
      "Client Project Manager",
      "HSE Officer",
      "Finance Officer",
    ]) {
      expect(select).not.toContain(contractRole);
    }
    expect(markup).not.toMatch(/id="invite-(contract-role|workspace)"/);
    expect(markup).toContain("contract roles are");
  });

  it("explains invitation expiry where invitations are sent", () => {
    const markup = renderToStaticMarkup(<CompanyTeamView />);

    expect(markup).toContain("expires after seven days");
    expect(markup).toContain('for="invite-email"');
    expect(markup).toContain('for="invite-role"');
    // The status legend is available behind a collapsed toggle.
    expect(markup).toContain("What do invitation statuses mean?");
    expect(markup).toContain('aria-expanded="false"');
  });

  it("shows statuses as badges and an expired pending invitation as expired", () => {
    const meta = {
      totalItems: 1,
      itemCount: 1,
      itemsPerPage: 20,
      totalPages: 1,
      currentPage: 1,
    };
    mocks.getMembers.mockReturnValue({
      currentData: {
        data: [
          {
            id: "membership-1",
            userId: "user-1",
            firstName: "Ada",
            lastName: "Obi",
            email: "ada@example.com",
            companyRole: "Member",
            status: "active",
            joinedAt: "2026-01-15T10:00:00.000Z",
          },
        ],
        meta,
      },
      isFetching: false,
      error: undefined,
      isLoading: false,
    });
    mocks.getInvitations.mockReturnValue({
      currentData: {
        data: [
          {
            id: "invitation-1",
            email: "late@example.com",
            firstName: null,
            lastName: null,
            companyRole: "Member",
            status: "pending",
            expiresAt: "2020-01-01T00:00:00.000Z",
          },
        ],
        meta,
      },
      isFetching: false,
      error: undefined,
      isLoading: false,
    });

    const markup = renderToStaticMarkup(<CompanyTeamView />);

    expect(markup).toContain('data-status="active"');
    expect(markup).toContain('data-status="expired"');
    expect(markup).toContain(">Expired</span>");
    expect(markup).not.toContain(">pending<");
    // An expired invitation can't be revoked, but it can be sent again.
    expect(markup).not.toContain(">Revoke</button>");
    expect(markup).toContain(">Resend</button>");
    expect(markup).toContain(
      'aria-label="Send the invitation to late@example.com again"',
    );
    expect(markup).toMatch(/Jan 15, 2026|15 Jan 2026/);
  });
  it.each([
    ["accepted", false],
    ["declined", false],
    ["revoked", false],
    ["expired", true],
  ])("offers Resend for a %s invitation: %s", (status, offered) => {
    const meta = {
      totalItems: 1,
      itemCount: 1,
      itemsPerPage: 20,
      totalPages: 1,
      currentPage: 1,
    };
    mocks.getInvitations.mockReturnValue({
      currentData: {
        data: [
          {
            id: "invitation-1",
            email: "person@example.com",
            firstName: null,
            lastName: null,
            companyRole: "Member",
            status,
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
        ],
        meta,
      },
      isFetching: false,
      error: undefined,
      isLoading: false,
    });

    const markup = renderToStaticMarkup(<CompanyTeamView />);

    expect(markup.includes(">Resend</button>")).toBe(offered);
  });

  it("gives the page one <h1> and its sections <h2> headings", () => {
    const markup = renderToStaticMarkup(<CompanyTeamView />);

    expect(markup).toMatch(/<h1[^>]*>Team &amp; invitations<\/h1>/);
    expect(markup).toMatch(/<h2[^>]*>Company members<\/h2>/);
    expect(headingProblems(markup)).toEqual([]);
  });
});
