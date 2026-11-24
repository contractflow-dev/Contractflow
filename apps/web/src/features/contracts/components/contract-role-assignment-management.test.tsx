import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContractRoleAssignmentManagement } from "./contract-role-assignment-management";

const { mocks, idle, mutation } = vi.hoisted(() => ({
  mocks: { permissions: vi.fn(), assignments: vi.fn(), workspaces: vi.fn() },
  idle: () => ({ data: [], isFetching: false, error: undefined }),
  mutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock("@/services/contractApi", () => ({
  useGetContractRoleManagementPermissionsQuery: mocks.permissions,
  useGetContractRoleAssignmentMembersQuery: () => ({
    data: [
      {
        id: "member-1",
        firstName: "Ada",
        lastName: "Obi",
        email: "ada@example.com",
      },
    ],
    isFetching: false,
  }),
  useGetContractRoleAssignmentsQuery: (...args: unknown[]) =>
    mocks.assignments(...args) ?? idle(),
  useGetContractWorkspacesQuery: (...args: unknown[]) =>
    mocks.workspaces(...args) ?? { data: [] },
  useGetContractRoleInvitationsQuery: idle,
  useAssignContractRoleMutation: mutation,
  useRevokeContractRoleMutation: mutation,
  useSetContractWorkspaceAdminMutation: mutation,
  useCreateContractRoleInvitationMutation: mutation,
  useRevokeContractRoleInvitationMutation: mutation,
}));

vi.mock("@/hooks/use-user-time-zone", () => ({
  useUserTimeZone: () => "UTC",
}));

function render(workspace: "project" | "hse" | "finance") {
  return renderToStaticMarkup(
    <ContractRoleAssignmentManagement
      companyId="company-1"
      contractId="contract-1"
      fixedWorkspace={workspace}
    />,
  );
}

describe("ContractRoleAssignmentManagement in a workspace", () => {
  beforeEach(() => {
    mocks.permissions.mockReset();
  });

  it("shows compact actions and the side, with no form on the page", () => {
    mocks.permissions.mockReturnValue({
      data: {
        canManage: true,
        canGrantWorkspaceAdmin: true,
        roleSide: "client",
        roles: ["Client Project Manager"],
      },
      isLoading: false,
    });

    const markup = render("project");

    expect(markup).toMatch(/Assign Member<\/button>/);
    expect(markup).toContain("Contract Role Invitations");
    expect(markup).toContain("on the client side of this contract");
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain("<select");
  });

  it("offers no actions to someone who can't manage the workspace", () => {
    mocks.permissions.mockReturnValue({
      data: {
        canManage: false,
        canGrantWorkspaceAdmin: false,
        roleSide: "client",
        roles: [],
      },
      isLoading: false,
    });

    expect(render("hse")).toBe("");
  });
});

const manageable = (roles: string[]) => ({
  data: {
    canManage: true,
    canGrantWorkspaceAdmin: true,
    roleSide: "contractor",
    roles,
  },
  isLoading: false,
});

const assignment = (
  id: string,
  firstName: string,
  role: string,
  isWorkspaceAdmin: boolean,
) => ({
  id,
  contractPartyId: "party-1",
  companyUserId: `member-${id}`,
  firstName,
  lastName: "Doe",
  email: `${firstName.toLowerCase()}@example.com`,
  role,
  isWorkspaceAdmin,
  assignedAt: "2026-11-01T10:00:00.000Z",
});

describe("ContractRoleAssignmentManagement workspaces side by side", () => {
  beforeEach(() => {
    mocks.permissions.mockReset();
    mocks.assignments.mockReset();
    mocks.workspaces.mockReset();
    mocks.workspaces.mockReturnValue({ data: ["project", "hse"] });
    mocks.permissions.mockImplementation(
      ({ workspace }: { workspace: string }) =>
        manageable(
          workspace === "hse"
            ? ["HSE Officer", "HSE Manager"]
            : ["Contractor Project Lead"],
        ),
    );
    mocks.assignments.mockImplementation(
      ({ workspace }: { workspace: string }) => ({
        data:
          workspace === "hse"
            ? [
                assignment("a1", "Ada", "HSE Manager", true),
                assignment("a2", "Bo", "HSE Officer", false),
              ]
            : [],
        isLoading: false,
      }),
    );
  });

  const renderOverview = (initialWorkspace?: "project" | "hse" | "finance") =>
    renderToStaticMarkup(
      <ContractRoleAssignmentManagement
        companyId="company-1"
        contractId="contract-1"
        initialWorkspace={initialWorkspace}
      />,
    );

  it("shows a card for each enabled workspace with its people and admins", () => {
    const markup = renderOverview();

    expect(markup).toContain("Roles and workspaces");
    expect(markup).toContain("Project workspace</h3>");
    expect(markup).toContain("HSE workspace</h3>");
    expect(markup).not.toContain("Finance workspace</h3>");
    expect(markup).toContain("Ada Doe");
    expect(markup.split(">Workspace Admin</span>").length - 1).toBe(1);
    expect(markup).toContain(
      "Project is enabled, but nobody from your company is assigned yet.",
    );
    expect(markup).toContain(
      'aria-label="Remove Workspace Admin rights from Ada Doe"',
    );
    expect(markup).toContain('aria-label="Revoke HSE Officer from Bo Doe"');
    expect(markup).toContain('aria-label="Add a member to the HSE workspace"');
  });

  it("warns when one person is a workspace's only admin", () => {
    expect(renderOverview()).toContain(
      "Ada Doe is the only HSE Workspace Admin.",
    );
  });

  it("keeps the forms out of the page, behind compact actions", () => {
    const markup = renderOverview("hse");

    expect(markup).not.toContain("Assign or invite");
    expect(markup).not.toContain("<form");
    expect(markup).toContain("Assign Member");
    expect(markup).toContain("Contract Role Invitations");
  });

  it("offers no actions when no workspace can be managed", () => {
    mocks.permissions.mockReturnValue({
      data: {
        canManage: false,
        canGrantWorkspaceAdmin: false,
        roleSide: "contractor",
        roles: [],
      },
      isLoading: false,
    });

    const markup = renderOverview();
    expect(markup).not.toContain("Assign Member");
    expect(markup).not.toContain("Contract Role Invitations");
  });

  it("explains a workspace the viewer can't manage, and offers no actions there", () => {
    mocks.permissions.mockImplementation(
      ({ workspace }: { workspace: string }) =>
        workspace === "hse"
          ? manageable(["HSE Officer", "HSE Manager"])
          : {
              data: {
                canManage: false,
                canGrantWorkspaceAdmin: false,
                roleSide: "contractor",
                roles: [],
              },
              isLoading: false,
            },
    );

    const markup = renderOverview("hse");

    expect(markup).toContain(
      "This workspace&#x27;s team is managed by its Workspace Admin or a Company Administrator.",
    );
    expect(markup).not.toContain(
      'aria-label="Add a member to the Project workspace"',
    );
  });
});
