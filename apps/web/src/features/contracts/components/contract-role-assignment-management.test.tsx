import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContractRoleAssignmentManagement } from "./contract-role-assignment-management";

const { mocks, idle, mutation } = vi.hoisted(() => ({
  mocks: { permissions: vi.fn() },
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
  useGetContractRoleAssignmentsQuery: idle,
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
