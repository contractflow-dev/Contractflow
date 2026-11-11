import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EContractStatus,
  type ContractWorkspaceAccess,
  EContractorContractRole,
} from "@contractflow/contracts-schema";
import {
  contractWorkspaceHref,
  parseContractWorkspace,
} from "../contract-workspaces";
import {
  ContractWorkspace,
  ContractWorkspacesCard,
} from "./contract-workspace-screens";

const mocks = vi.hoisted(() => ({
  contract: vi.fn(),
  access: vi.fn(),
  workspace: vi.fn(),
  sectionAccess: { roles: false, sites: false, signatories: false } as Record<
    string,
    boolean | undefined
  >,
  roleManagement: vi.fn(),
}));

vi.mock("@/services/contractApi", () => ({
  useGetContractByIdQuery: mocks.contract,
  useGetContractWorkspaceAccessQuery: mocks.access,
  useGetContractWorkspaceQuery: mocks.workspace,
}));
vi.mock("../_hooks/use-contract-section-access", () => ({
  useContractSectionAccess: () => mocks.sectionAccess,
}));
vi.mock("./contract-role-assignment-management", () => ({
  ContractRoleAssignmentManagement: (props: { fixedWorkspace?: string }) => {
    mocks.roleManagement(props);
    return <div>ROLE MANAGEMENT for {props.fixedWorkspace}</div>;
  },
}));

const contract = {
  contract: {
    id: "contract-1",
    referenceNumber: "CTR-001",
    title: "Alpha pipeline integrity",
    status: EContractStatus.ACTIVE,
    deletedAt: null,
  },
  membership: {
    id: "m",
    companyId: "company-1",
    partyType: "contractor",
    signedAt: null,
  },
};

function entry(
  workspace: ContractWorkspaceAccess["workspace"],
  overrides: Partial<ContractWorkspaceAccess> = {},
): ContractWorkspaceAccess {
  return {
    workspace,
    hasAccess: false,
    roles: [],
    isWorkspaceAdmin: false,
    canManageTeam: false,
    ...overrides,
  };
}
const projectLead = entry("project", {
  hasAccess: true,
  roles: [EContractorContractRole.CONTRACTOR_PROJECT_LEAD],
});
const hseAdmin = entry("hse", {
  hasAccess: true,
  roles: [EContractorContractRole.HSE_OFFICER],
  isWorkspaceAdmin: true,
  canManageTeam: true,
});

const ok = <T,>(currentData: T) => ({
  currentData,
  error: undefined,
  isLoading: false,
  refetch: vi.fn(),
});
const failed = (status: number) => ({
  currentData: undefined,
  error: { status, data: {} },
  isLoading: false,
  refetch: vi.fn(),
});

function renderWorkspace(
  workspace: ContractWorkspaceAccess["workspace"],
  view: "overview" | "team" = "overview",
) {
  return renderToStaticMarkup(
    <ContractWorkspace
      companyId="company-1"
      contractId="contract-1"
      workspace={workspace}
      view={view}
    />,
  );
}

beforeEach(() => {
  mocks.sectionAccess = { roles: false, sites: false, signatories: false };
  mocks.roleManagement.mockReset();
  mocks.contract.mockReturnValue(ok(contract));
  mocks.access.mockReturnValue(
    ok({ workspaces: [projectLead, hseAdmin, entry("finance")] }),
  );
});

describe("workspace routes", () => {
  it("accepts only the three workspaces and keeps the contract in the URL", () => {
    expect(parseContractWorkspace("project")).toBe("project");
    expect(parseContractWorkspace("hse")).toBe("hse");
    expect(parseContractWorkspace("finance")).toBe("finance");
    for (const other of ["general", "admin", "", "Project"]) {
      expect(parseContractWorkspace(other)).toBeNull();
    }
    expect(contractWorkspaceHref("c 1", "hse")).toBe(
      "/dashboards/contracts/c%201/workspaces/hse",
    );
    expect(contractWorkspaceHref("c1", "finance", "team")).toBe(
      "/dashboards/contracts/c1/workspaces/finance/team",
    );
  });
});

describe("ContractWorkspace", () => {
  it("asks the API for exactly this workspace of this contract", () => {
    mocks.workspace.mockReturnValue(ok(projectLead));
    renderWorkspace("project");
    expect(mocks.workspace).toHaveBeenCalledWith({
      companyId: "company-1",
      contractId: "contract-1",
      workspace: "project",
    });
  });

  it("names the contract and workspace, and offers only workspaces the member can enter", () => {
    mocks.workspace.mockReturnValue(ok(projectLead));
    const markup = renderWorkspace("project");

    expect(markup).toContain("CTR-001 · Alpha pipeline integrity");
    expect(markup).toMatch(/<h1[^>]*>Project workspace<\/h1>/);
    expect(markup).toContain('aria-label="Workspaces"');
    const current = [...markup.matchAll(/<a ([^>]*)>/g)]
      .map(([, attributes]) => attributes)
      .filter((attributes) => attributes.includes('aria-current="page"'));
    // The Project tab and the workspace's Overview link: the same page.
    expect(current).toHaveLength(2);
    for (const attributes of current) {
      expect(attributes).toContain(
        'href="/dashboards/contracts/contract-1/workspaces/project"',
      );
    }
    expect(markup).toContain(
      'href="/dashboards/contracts/contract-1/workspaces/hse"',
    );
    // No role in Finance: no way in from here.
    expect(markup).not.toContain("/workspaces/finance");
  });

  it("shows the member's real role and what the workspace holds, with planned items marked", () => {
    mocks.workspace.mockReturnValue(ok(projectLead));
    mocks.sectionAccess = { roles: false, sites: false, signatories: false };
    const markup = renderWorkspace("project");

    expect(markup).toContain(">Contractor Project Lead<");
    expect(markup).not.toContain("Workspace Admin<");
    expect(markup).toContain(
      "Your workspace administrator manages who is on this team.",
    );
    expect(markup).toContain("About this workspace");
    expect(markup).toContain(
      'href="/dashboards/contracts/contract-1/documents"',
    );
    expect(markup).toContain('href="/dashboards/contracts/contract-1/history"');
    // Sites is a restricted section this member can't use.
    expect(markup).not.toContain(
      'href="/dashboards/contracts/contract-1/sites"',
    );
    expect(markup).toContain("Daily site logs");
    expect(markup.match(/>Planned</g)?.length).toBeGreaterThanOrEqual(3);
    // No Team entry without team rights.
    expect(markup).not.toContain("/workspaces/project/team");
  });

  it("offers team management to a Workspace Admin", () => {
    mocks.workspace.mockReturnValue(ok(hseAdmin));
    const markup = renderWorkspace("hse");

    expect(markup).toContain("Workspace Admin");
    expect(markup).toMatch(
      /href="\/dashboards\/contracts\/contract-1\/workspaces\/hse\/team"[^>]*>.*Team/,
    );
    expect(markup).toContain("Manage the HSE team");
  });

  it("reuses the existing role management, fixed to the workspace, on the Team view", () => {
    mocks.workspace.mockReturnValue(ok(hseAdmin));
    const markup = renderWorkspace("hse", "team");

    expect(markup).toContain("ROLE MANAGEMENT for hse");
    expect(mocks.roleManagement).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        contractId: "contract-1",
        fixedWorkspace: "hse",
      }),
    );
  });

  it("refuses the Team view without team rights, even by direct URL", () => {
    mocks.workspace.mockReturnValue(ok(projectLead));
    const markup = renderWorkspace("project", "team");

    expect(markup).toContain("Team management is for Workspace Admins");
    expect(mocks.roleManagement).not.toHaveBeenCalled();
  });

  it("explains a refused workspace (403) without showing its content", () => {
    mocks.workspace.mockReturnValue(failed(403));
    const markup = renderWorkspace("finance");

    expect(markup).toContain(
      "You don&#x27;t have access to the Finance workspace",
    );
    expect(markup).not.toContain("About this workspace");
    expect(markup).not.toContain("Your access");
  });

  it("explains a workspace the contract doesn't have (404), and other failures with Retry", () => {
    mocks.workspace.mockReturnValue(failed(404));
    expect(renderWorkspace("hse")).toContain(
      "This contract has no HSE workspace",
    );

    mocks.workspace.mockReturnValue(failed(500));
    const markup = renderWorkspace("hse");
    expect(markup).toContain("The workspace could not be loaded");
    expect(markup).toMatch(/<button[^>]*>Retry<\/button>/);
  });

  it("shows a loading state, and a missing contract", () => {
    mocks.workspace.mockReturnValue({
      currentData: undefined,
      error: undefined,
      isLoading: true,
      refetch: vi.fn(),
    });
    expect(renderWorkspace("project")).toContain(
      'aria-label="Loading workspace"',
    );

    mocks.workspace.mockReturnValue(ok(projectLead));
    mocks.contract.mockReturnValue(failed(404));
    const missing = renderWorkspace("project");
    expect(missing).toContain("Contract was not found");
    // Said once, then explained.
    expect(missing.match(/Contract was not found/g)).toHaveLength(1);
    expect(missing).toContain("you don&#x27;t have access to it");
    expect(missing).not.toContain("Retry");
  });
});

describe("ContractWorkspacesCard", () => {
  const render = (canAssignRoles = false) =>
    renderToStaticMarkup(
      <ContractWorkspacesCard
        companyId="company-1"
        contractId="contract-1"
        canAssignRoles={canAssignRoles}
      />,
    );

  it("links to each workspace the member holds a role in, with that role", () => {
    const markup = render();
    expect(markup).toMatch(
      /href="\/dashboards\/contracts\/contract-1\/workspaces\/project"[^>]*>[\s\S]*Project workspace/,
    );
    expect(markup).toContain("Contractor Project Lead");
    expect(markup).toContain("HSE Officer · Workspace Admin");
    expect(markup).not.toContain("/workspaces/finance");
  });

  it("explains when the member holds no workspace role", () => {
    mocks.access.mockReturnValue(
      ok({ workspaces: [entry("project"), entry("finance")] }),
    );
    expect(render()).toContain(
      "You don&#x27;t hold a role in this contract&#x27;s Project or Finance workspaces.",
    );
    expect(render(true)).toContain("in the Roles section");
    expect(render()).not.toMatch(/<a /);
  });

  it("tells a Company Administrator without a role that oversight opens no workspace", () => {
    // Oversight: every enabled workspace is listed, none can be entered.
    mocks.access.mockReturnValue(
      ok({
        workspaces: [entry("project"), entry("hse"), entry("finance")],
      }),
    );
    const markup = render(true);
    expect(markup).toContain(
      "As a Company Administrator you can view this contract&#x27;s details, parties and history, but workspaces, activity and documents need a contract role.",
    );
    expect(markup).not.toMatch(/<a /);
    expect(markup).not.toContain("/workspaces/");
  });

  it("handles a contract without workspaces, loading and errors", () => {
    mocks.access.mockReturnValue(ok({ workspaces: [] }));
    expect(render()).toContain("This contract has no workspaces yet.");

    mocks.access.mockReturnValue({
      currentData: undefined,
      error: undefined,
      isLoading: true,
      refetch: vi.fn(),
    });
    expect(render()).toContain('aria-label="Loading your workspaces"');

    mocks.access.mockReturnValue(failed(500));
    const markup = render();
    expect(markup).toContain("Unable to load your workspaces.");
    expect(markup).toMatch(/<button[^>]*>Retry<\/button>/);
  });
});
