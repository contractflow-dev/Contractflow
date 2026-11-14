import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ECompanyRole,
  ECompanyUserStatus,
  EContractStatus,
  EContractorContractRole,
  type ICompanyMember,
} from "@contractflow/contracts-schema";
import type { ReactElement } from "react";
import { Dialog } from "@workspace/ui/components/dialog";
import type { CompanyRoleAssignment } from "@/services/contractApi";
import { AssignContractRoleForm } from "./assign-contract-role-dialog";
import { ContractRoleActions } from "./contract-role-actions";
import { MemberDetails } from "./member-details-sheet";
import { TeamSummary } from "./team-summary";

const mocks = vi.hoisted(() => ({
  summary: vi.fn(),
  members: vi.fn(),
  roles: vi.fn(),
  contracts: vi.fn(),
  workspaces: vi.fn(),
  permissions: vi.fn(),
  mutation: () => [vi.fn(), { isLoading: false, reset: vi.fn() }],
}));

vi.mock("@/services/companiesApi", () => ({
  useGetCompanyTeamSummaryQuery: mocks.summary,
  useGetCompanyMembersQuery: mocks.members,
}));
vi.mock("@/services/contractApi", () => ({
  useGetCompanyRoleAssignmentsQuery: mocks.roles,
  useGetContractsQuery: mocks.contracts,
  useGetContractWorkspacesQuery: mocks.workspaces,
  useGetContractRoleManagementPermissionsQuery: mocks.permissions,
  useAssignContractRoleMutation: mocks.mutation,
  useRevokeContractRoleMutation: mocks.mutation,
  useSetContractWorkspaceAdminMutation: mocks.mutation,
}));
vi.mock("@/hooks/use-user-time-zone", () => ({ useUserTimeZone: () => "UTC" }));

const member: ICompanyMember = {
  id: "member-1",
  userId: "user-1",
  firstName: "Casey",
  lastName: "Okafor",
  email: "casey@acme.test",
  companyRole: ECompanyRole.MEMBER,
  status: ECompanyUserStatus.ACTIVE,
  joinedAt: "2026-01-15T10:00:00.000Z",
  leftAt: null,
};

const role: CompanyRoleAssignment = {
  id: "assignment-1",
  contractId: "contract-1",
  contractReference: "CF-2026-0142",
  contractTitle: "Pipeline integrity",
  contractStatus: EContractStatus.ACTIVE,
  companyUserId: "member-1",
  firstName: "Casey",
  lastName: "Okafor",
  email: "casey@acme.test",
  role: EContractorContractRole.HSE_OFFICER,
  workspace: "hse",
  isWorkspaceAdmin: false,
  assignedAt: "2026-02-01T09:00:00.000Z",
};

const page = <T,>(data: T[]) => ({
  data,
  meta: {
    totalItems: data.length,
    itemCount: data.length,
    itemsPerPage: 100,
    totalPages: 1,
    currentPage: 1,
  },
});

/**
 * The sheet's and dialog's content, inside an open dialog root (their titles
 * need its context). The portal and overlay aren't rendered on the server.
 */
const renderOpen = (node: ReactElement) =>
  renderToStaticMarkup(<Dialog open>{node}</Dialog>);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.members.mockReturnValue({ currentData: page([member]) });
  mocks.contracts.mockReturnValue({
    currentData: page([
      {
        id: "contract-1",
        title: "Pipeline integrity",
        referenceNumber: "CF-2026-0142",
        status: EContractStatus.ACTIVE,
      },
    ]),
    isLoading: false,
  });
  mocks.workspaces.mockReturnValue({ currentData: undefined });
  mocks.permissions.mockReturnValue({ currentData: undefined });
});

describe("TeamSummary", () => {
  it("shows the API's team figures with what each one counts", () => {
    mocks.summary.mockReturnValue({
      currentData: {
        memberCount: 12,
        activeMemberCount: 9,
        companyAdminCount: 2,
        pendingInvitationCount: 3,
      },
    });

    const markup = renderToStaticMarkup(<TeamSummary companyId="company-1" />);

    expect(mocks.summary).toHaveBeenCalledWith({ companyId: "company-1" });
    for (const [value, label] of [
      ["12", "Members"],
      ["9", "Active members"],
      ["2", "Company administrators"],
      ["3", "Pending invitations"],
    ]) {
      expect(markup).toMatch(new RegExp(`>${value}</p><p[^>]*>${label}</p>`));
    }
  });

  it("shows placeholders while loading and the API's message on failure", () => {
    mocks.summary.mockReturnValue({ isLoading: true });
    expect(renderToStaticMarkup(<TeamSummary companyId="c" />)).toContain(
      "Loading team figures…",
    );

    mocks.summary.mockReturnValue({
      error: {
        status: 403,
        data: {
          message: "Only company administrators can manage this company.",
        },
      },
    });
    expect(renderToStaticMarkup(<TeamSummary companyId="c" />)).toContain(
      "Only company administrators can manage this company.",
    );
  });
});

describe("MemberDetails", () => {
  it("shows the membership separately from the member's contract roles", () => {
    mocks.roles.mockReturnValue({ currentData: page([role]) });

    const markup = renderOpen(
      <MemberDetails companyId="company-1" member={member} />,
    );

    expect(mocks.roles).toHaveBeenCalledWith(
      {
        companyId: "company-1",
        companyUserId: "member-1",
        page: 1,
        limit: 100,
      },
      { refetchOnMountOrArgChange: true },
    );
    expect(markup).toContain("Company membership");
    expect(markup).toContain("Member");
    expect(markup).toContain("Pipeline integrity");
    expect(markup).toContain("HSE Officer · HSE workspace");
    expect(markup).toContain(
      'aria-label="Make Casey Okafor workspace administrator for HSE on Pipeline integrity"',
    );
    expect(markup).toMatch(/<button[^>]*>Assign to a contract<\/button>/);
  });

  it("says plainly when an active member can't open any contract", () => {
    mocks.roles.mockReturnValue({ currentData: page([]) });

    expect(
      renderOpen(<MemberDetails companyId="c" member={member} />),
    ).toContain(
      "has no contract roles, so they can&#x27;t open any contract yet.",
    );
  });

  it("offers no assignment for a former member", () => {
    mocks.roles.mockReturnValue({ currentData: page([]) });

    const markup = renderOpen(
      <MemberDetails
        companyId="c"
        member={{
          ...member,
          status: ECompanyUserStatus.INACTIVE,
          leftAt: "2026-03-01T00:00:00.000Z",
        }}
      />,
    );

    expect(markup).not.toContain("Assign to a contract");
    expect(markup).toContain("Left");
  });

  it("notes that a Company Administrator has no workspace access by default", () => {
    mocks.roles.mockReturnValue({ currentData: page([]) });

    expect(
      renderOpen(
        <MemberDetails
          companyId="c"
          member={{ ...member, companyRole: ECompanyRole.COMPANY_ADMIN }}
        />,
      ),
    ).toContain("don&#x27;t work in a contract workspace unless");
  });
});

describe("ContractRoleActions", () => {
  it("names the member, workspace and contract in each action", () => {
    const markup = renderToStaticMarkup(
      <ContractRoleActions
        companyId="c"
        row={{ ...role, isWorkspaceAdmin: true }}
      />,
    );

    expect(markup).toContain(
      'aria-label="Remove workspace administrator rights from Casey Okafor for HSE on Pipeline integrity"',
    );
    expect(markup).toContain(
      'aria-label="Revoke HSE Officer from Casey Okafor on Pipeline integrity"',
    );
  });
});

describe("AssignContractRoleForm", () => {
  it("lists the company's contracts and waits for a contract before workspaces and roles", () => {
    const markup = renderOpen(
      <AssignContractRoleForm
        companyId="company-1"
        member={member}
        onDone={vi.fn()}
      />,
    );

    expect(mocks.contracts).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "company-1", sortBy: "title" }),
    );
    // Nothing contract-specific is asked for until a contract is chosen.
    expect(mocks.workspaces).toHaveBeenCalledWith(
      { companyId: "company-1", contractId: "" },
      { skip: true },
    );
    expect(mocks.permissions).toHaveBeenCalledWith(expect.anything(), {
      skip: true,
    });
    expect(markup).toContain("Pipeline integrity · CF-2026-0142 (Active)");
    expect(markup).toContain("Casey Okafor");
    // The fixed member isn't asked for again.
    expect(mocks.members).toHaveBeenCalledWith(expect.anything(), {
      skip: true,
    });
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
    expect(markup).toContain("Company membership");
  });

  it("asks for a member when none is fixed", () => {
    const markup = renderOpen(
      <AssignContractRoleForm companyId="company-1" onDone={vi.fn()} />,
    );

    expect(mocks.members).toHaveBeenCalledWith(
      expect.objectContaining({ status: ECompanyUserStatus.ACTIVE }),
      { skip: false },
    );
    expect(markup).toContain("Choose a member");
  });

  it("explains when the company is party to no contract", () => {
    mocks.contracts.mockReturnValue({
      currentData: page([]),
      isLoading: false,
    });

    expect(
      renderOpen(
        <AssignContractRoleForm
          companyId="c"
          member={member}
          onDone={vi.fn()}
        />,
      ),
    ).toContain("Your company isn&#x27;t a party to any contract yet.");
  });
});
