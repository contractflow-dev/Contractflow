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

/** The values offered by the contract role select. */
function offeredRoles(markup: string): string[] {
  const start = markup.indexOf('aria-label="Assign a contract role"');
  const select = markup.slice(
    markup.indexOf("<select", markup.indexOf("Contract role", start)),
  );
  const options = select.slice(0, select.indexOf("</select>"));
  return [...options.matchAll(/value="([^"]*)"/g)].map(([, value]) => value);
}

function render(workspace: "project" | "hse" | "finance") {
  return renderToStaticMarkup(
    <ContractRoleAssignmentManagement
      companyId="company-1"
      contractId="contract-1"
      fixedWorkspace={workspace}
    />,
  );
}

describe("ContractRoleAssignmentManagement role sides", () => {
  beforeEach(() => {
    mocks.permissions.mockReset();
  });

  it("offers a client party only the client roles the API returns", () => {
    mocks.permissions.mockReturnValue({
      data: {
        canManage: true,
        canGrantWorkspaceAdmin: true,
        roleSide: "client",
        roles: ["Client Project Manager", "Client Site Engineer"],
      },
      isLoading: false,
    });

    const markup = render("project");

    expect(offeredRoles(markup)).toEqual([
      "Client Project Manager",
      "Client Site Engineer",
    ]);
    expect(markup).not.toContain("Contractor Project Lead");
    expect(markup).not.toContain("Contractor Site Supervisor");
    expect(markup).toContain("on the client side of this contract");
  });

  it("offers a contractor-side party only contractor roles", () => {
    mocks.permissions.mockReturnValue({
      data: {
        canManage: true,
        canGrantWorkspaceAdmin: false,
        roleSide: "contractor",
        roles: ["Contractor Project Lead", "Contractor Site Supervisor"],
      },
      isLoading: false,
    });

    const markup = render("project");

    expect(offeredRoles(markup)).toEqual([
      "Contractor Project Lead",
      "Contractor Site Supervisor",
    ]);
    expect(markup).not.toContain("Client Project Manager");
    expect(markup).toContain("on the contractor side of this contract");
  });

  it("offers the shared HSE roles to whichever side manages the workspace", () => {
    mocks.permissions.mockReturnValue({
      data: {
        canManage: true,
        canGrantWorkspaceAdmin: true,
        roleSide: "client",
        roles: ["HSE Officer", "HSE Manager"],
      },
      isLoading: false,
    });

    expect(offeredRoles(render("hse"))).toEqual(["HSE Officer", "HSE Manager"]);
  });

  it("disables assigning when the API offers no roles", () => {
    mocks.permissions.mockReturnValue({
      data: {
        canManage: true,
        canGrantWorkspaceAdmin: true,
        roleSide: "contractor",
        roles: [],
      },
      isLoading: false,
    });

    const markup = render("finance");
    expect(offeredRoles(markup)).toEqual([]);
    const form = markup.slice(
      markup.indexOf('aria-label="Assign a contract role"'),
    );
    expect(form.slice(0, form.indexOf("</form>"))).toMatch(
      /<button[^>]*type="submit"[^>]*disabled=""/,
    );
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

  it("keeps the assign and invite forms, opened on the workspace from the link", () => {
    const markup = renderOverview("hse");

    expect(markup).toContain(">Assign or invite</h2>");
    expect(mocks.permissions).toHaveBeenCalledWith({
      companyId: "company-1",
      contractId: "contract-1",
      workspace: "hse",
    });
    expect(offeredRoles(markup)).toEqual(["HSE Officer", "HSE Manager"]);
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
