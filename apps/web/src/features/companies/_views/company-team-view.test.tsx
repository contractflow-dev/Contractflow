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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboards/team",
  useSearchParams: () => new URLSearchParams(),
}));

// Covered by its own tests.
vi.mock("../components/team-summary", () => ({
  TeamSummary: () => <section aria-label="Team summary">TEAM SUMMARY</section>,
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

  it("invites from the members card's Invite member action, not an inline form", () => {
    const markup = renderToStaticMarkup(<CompanyTeamView />);

    // The action follows the members heading, before the member filters.
    const heading = markup.indexOf(">Members</h2>");
    const action = markup.search(
      /<button[^>]*aria-haspopup="dialog"[^>]*>(?:<svg[\s\S]*?<\/svg>)?Invite member<\/button>/,
    );
    expect(heading).toBeGreaterThanOrEqual(0);
    expect(action).toBeGreaterThan(heading);
    expect(action).toBeLessThan(markup.indexOf('id="member-search"'));
    // The form lives in the dialog (see invite-member-dialog.test.tsx).
    expect(markup).not.toContain('id="invite-email"');
    expect(markup).not.toContain(">Invite a team member</h2>");
  });

  it("leaves invitations and contract roles to their own Team entries", () => {
    const markup = renderToStaticMarkup(<CompanyTeamView />);

    // Invitations is a dialog and Contract roles a page of its own; both
    // are covered by their own tests.
    expect(markup).not.toContain('aria-label="Invitations"');
    expect(markup).not.toContain("What do invitation statuses mean?");
    expect(markup).not.toContain("Role assignments");
    expect(mocks.getInvitations).not.toHaveBeenCalled();
  });

  it("filters members by company role, sorts them, and opens a member's details", () => {
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
            leftAt: null,
          },
        ],
        meta: {
          totalItems: 1,
          itemCount: 1,
          itemsPerPage: 20,
          totalPages: 1,
          currentPage: 1,
        },
      },
      isFetching: false,
      error: undefined,
      isLoading: false,
    });

    const markup = renderToStaticMarkup(<CompanyTeamView />);

    // Newest first is the default, sent to the API explicitly.
    expect(mocks.getMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        sortBy: "joinedAt",
        sortOrder: "DESC",
        companyRole: undefined,
      }),
    );
    const roleFilter = markup.slice(
      markup.indexOf('id="member-role"'),
      markup.indexOf("</select>", markup.indexOf('id="member-role"')),
    );
    expect(
      [...roleFilter.matchAll(/value="([^"]*)"/g)].map(([, v]) => v),
    ).toEqual(["", "Company Administrator", "Member"]);
    expect(markup).toContain('id="member-sort"');
    expect(markup).toContain("Name (A–Z)");
    expect(markup).toContain(
      'aria-label="View details and contract roles for Ada Obi"',
    );
    expect(markup).toContain("TEAM SUMMARY");
    // The members table is named, and a row's actions sit in one menu.
    expect(markup).toContain('aria-label="Company members"');
    expect(markup).toContain('aria-label="Actions for Ada Obi"');
  });

  it("offers Retry when members fail to load", () => {
    const failed = {
      currentData: undefined,
      isFetching: false,
      error: { status: 500, data: {} },
      isLoading: false,
      refetch: vi.fn(),
    };
    mocks.getMembers.mockReturnValue(failed);

    const markup = renderToStaticMarkup(<CompanyTeamView />);

    expect(markup).toContain("Company members could not be loaded.");
    expect(markup.match(/>Retry<\/button>/g)).toHaveLength(1);
  });

  it("gives the page one <h1> and its sections <h2> headings", () => {
    const markup = renderToStaticMarkup(<CompanyTeamView />);

    expect(markup).toMatch(/<h1[^>]*>Company members<\/h1>/);
    expect(markup).toMatch(/<h2[^>]*>Members<\/h2>/);
    expect(headingProblems(markup)).toEqual([]);
  });
});
