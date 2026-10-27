import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyTeamView } from "./company-team-view";

const mocks = vi.hoisted(() => ({
  changeRole: vi.fn(),
  getInvitations: vi.fn(),
  getMembers: vi.fn(),
  inviteMember: vi.fn(),
  removeMember: vi.fn(),
  revokeInvitation: vi.fn(),
}));

vi.mock("../CompanyAdminShell", () => ({
  CompanyAdminShell: ({
    children,
  }: {
    children: (access: { company: { id: string } }) => ReactNode;
  }) => children({ company: { id: "company-1" } }),
}));

vi.mock("@/features/companies", () => ({
  useChangeCompanyMemberRoleMutation: () => [mocks.changeRole],
  useGetCompanyInvitationsQuery: mocks.getInvitations,
  useGetCompanyMembersQuery: mocks.getMembers,
  useInviteCompanyMemberMutation: () => [
    mocks.inviteMember,
    { isLoading: false },
  ],
  useRemoveCompanyMemberMutation: () => [mocks.removeMember],
  useRevokeCompanyInvitationMutation: () => [mocks.revokeInvitation],
}));

describe("CompanyTeamView", () => {
  beforeEach(() => {
    mocks.getMembers.mockReturnValue({
      currentData: { items: [], total: 0, page: 1, limit: 20 },
      error: undefined,
      isLoading: false,
    });
    mocks.getInvitations.mockReturnValue({
      currentData: { items: [], total: 0, page: 1, limit: 50 },
      error: undefined,
      isLoading: false,
    });
  });

  it("collects only the email and role required by the invitation API", () => {
    const markup = renderToStaticMarkup(<CompanyTeamView />);

    expect(markup).toContain('id="invite-email"');
    expect(markup).not.toContain('id="invite-first-name"');
    expect(markup).not.toContain('id="invite-last-name"');
    expect(markup).toContain("No invitations have been sent.");
  });
});
