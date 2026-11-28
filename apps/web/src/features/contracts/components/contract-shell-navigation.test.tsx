import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EClientContractRole,
  EContractStatus,
  EPartyType,
} from "@contractflow/contracts-schema";
import {
  ContractBreadcrumbs,
  ContractNavigationBoundary,
  type ContractShellNavigation,
} from "./contract-shell-navigation";

const mocks = vi.hoisted(() => ({
  pathname: "/dashboards/contracts/c-1",
  contract: vi.fn(),
  workspaces: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/services/contractApi", () => ({
  useGetContractByIdQuery: mocks.contract,
  useGetContractWorkspaceAccessQuery: mocks.workspaces,
}));
vi.mock("../_hooks/use-contract-section-access", () => ({
  useContractSectionAccess: () => ({
    roles: false,
    sites: false,
    signatories: false,
  }),
}));

const loaded = {
  currentData: {
    contract: {
      referenceNumber: "CTR-1",
      title: "Pipeline integrity",
      status: EContractStatus.ACTIVE,
      deletedAt: null,
    },
    membership: { partyType: EPartyType.AWARDING },
  },
  error: undefined,
};

function resolve(): ContractShellNavigation | null {
  let result: ContractShellNavigation | null = null;
  renderToStaticMarkup(
    <ContractNavigationBoundary
      companyId="company-1"
      companyName="Acme"
      companyHref="/dashboards"
      contractId="c-1"
    >
      {(navigation) => {
        result = navigation;
        return null;
      }}
    </ContractNavigationBoundary>,
  );
  return result;
}

beforeEach(() => {
  mocks.pathname = "/dashboards/contracts/c-1";
  mocks.contract.mockReturnValue(loaded);
  mocks.workspaces.mockReturnValue({
    currentData: {
      workspaces: [
        {
          workspace: "project",
          hasAccess: true,
          roles: [EClientContractRole.CLIENT_PROJECT_MANAGER],
          isWorkspaceAdmin: false,
          canManageTeam: false,
        },
        {
          workspace: "finance",
          hasAccess: false,
          roles: [],
          isWorkspaceAdmin: false,
          canManageTeam: false,
        },
      ],
    },
  });
});

describe("ContractNavigationBoundary", () => {
  it("identifies the contract and lists only workspaces the member can enter", () => {
    const navigation = resolve()!;
    expect(navigation.module.back?.href).toBe("/dashboards/contracts");
    expect(renderToStaticMarkup(<>{navigation.module.heading}</>)).toContain(
      "Pipeline integrity",
    );
    const groups = navigation.module.pageGroups!.map(({ label }) => label);
    expect(groups).toEqual(["Contract", "Project"]);
    const project = navigation.module.pageGroups![1].items.map((i) => i.label);
    // The client's Client Project Manager decides on submissions.
    expect(project).toContain("Reviews");
  });

  it("shows no contract navigation for a refused or missing contract", () => {
    mocks.contract.mockReturnValue({
      currentData: undefined,
      error: { status: 404 },
    });
    expect(resolve()).toBeNull();
  });

  it("shows a loading identity, and no pages, until the API has answered", () => {
    mocks.contract.mockReturnValue({
      currentData: undefined,
      error: undefined,
    });
    const navigation = resolve()!;
    expect(navigation.module.pageGroups).toEqual([]);
    expect(navigation.crumbs).toEqual([]);
    expect(renderToStaticMarkup(<>{navigation.module.heading}</>)).toContain(
      'aria-label="Loading contract"',
    );
  });
});

describe("ContractBreadcrumbs", () => {
  it("marks the current page and links the rest", () => {
    const markup = renderToStaticMarkup(
      <ContractBreadcrumbs
        crumbs={[{ label: "Acme", href: "/dashboards" }, { label: "CTR-1" }]}
      />,
    );
    expect(markup).toMatch(/<a[^>]*href="\/dashboards"[^>]*>Acme<\/a>/);
    expect(markup).toMatch(/aria-current="page"[^>]*>CTR-1</);
  });
});
