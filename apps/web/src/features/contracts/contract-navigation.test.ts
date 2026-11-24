import { describe, expect, it } from "vitest";
import {
  EClientContractRole,
  type ContractWorkspaceAccess,
} from "@contractflow/contracts-schema";
import { activeNavChild } from "@/components/app-shell/navigation";
import {
  contractBreadcrumbs,
  contractIdFromPath,
  contractNavigationGroups,
} from "./contract-navigation";

const base = "/dashboards/contracts/c-1";
const noSections = { roles: false, sites: false, signatories: false };
const allSections = { roles: true, sites: true, signatories: true };

function access(
  workspace: ContractWorkspaceAccess["workspace"],
  overrides: Partial<ContractWorkspaceAccess> = {},
): ContractWorkspaceAccess {
  return {
    workspace,
    hasAccess: true,
    roles: [EClientContractRole.CLIENT_PROJECT_MANAGER],
    isWorkspaceAdmin: false,
    canManageTeam: false,
    ...overrides,
  };
}

const groupsFor = (
  overrides: Partial<Parameters<typeof contractNavigationGroups>[0]> = {},
) =>
  contractNavigationGroups({
    contractId: "c-1",
    pathname: base,
    sectionAccess: allSections,
    workspaces: [access("project"), access("hse", { canManageTeam: true })],
    canReviewMilestones: true,
    ...overrides,
  });

const named = (groups: ReturnType<typeof groupsFor>) =>
  groups.map(({ label, items }) => [label, items.map((item) => item.label)]);

describe("contractIdFromPath", () => {
  it("finds the contract on any of its pages", () => {
    expect(contractIdFromPath(base)).toBe("c-1");
    expect(contractIdFromPath(`${base}/parties`)).toBe("c-1");
    expect(
      contractIdFromPath(`${base}/workspaces/project/milestones/m-1`),
    ).toBe("c-1");
  });

  it("treats company pages, and creating a contract, as no contract", () => {
    for (const path of [
      "/dashboards",
      "/dashboards/contracts",
      "/dashboards/contracts/new",
      "/dashboards/my-contracts",
    ]) {
      expect(contractIdFromPath(path), path).toBeNull();
    }
  });
});

describe("contractNavigationGroups", () => {
  it("groups the contract's pages, its workspaces and administration", () => {
    expect(named(groupsFor())).toEqual([
      [
        "Contract",
        [
          "Overview",
          "Parties",
          "Sites",
          "Signatories",
          "Documents",
          "Status history",
        ],
      ],
      [
        "Project",
        ["Project overview", "Stages", "Milestones", "Reviews", "Activity"],
      ],
      ["HSE", ["HSE overview", "HSE team"]],
      ["Administration", ["Role assignments"]],
    ]);
  });

  it("gives a Company Administrator without a role no workspace", () => {
    const labels = named(
      groupsFor({
        workspaces: [
          access("project", { hasAccess: false, roles: [] }),
          access("hse", { hasAccess: false, roles: [] }),
          access("finance", { hasAccess: false, roles: [] }),
        ],
      }),
    ).map(([label]) => label);
    expect(labels).toEqual(["Contract", "Administration"]);
  });

  it("hides restricted sections, Reviews and team pages without permission", () => {
    const groups = groupsFor({
      sectionAccess: noSections,
      workspaces: [access("project")],
      canReviewMilestones: false,
    });
    expect(named(groups)).toEqual([
      ["Contract", ["Overview", "Parties", "Documents", "Status history"]],
      ["Project", ["Project overview", "Stages", "Milestones", "Activity"]],
    ]);
  });

  it("treats an unknown permission as not allowed", () => {
    const groups = groupsFor({
      sectionAccess: {
        roles: undefined,
        sites: undefined,
        signatories: undefined,
      },
    });
    const labels = groups.flatMap(({ items }) => items.map((i) => i.label));
    expect(labels).not.toContain("Sites");
    expect(labels).not.toContain("Role assignments");
  });

  it("keeps a refused section listed only while it is the open page", () => {
    const groups = groupsFor({
      pathname: `${base}/roles`,
      sectionAccess: noSections,
    });
    expect(groups.at(-1)?.label).toBe("Administration");
  });

  it("marks exactly the right page on nested routes", () => {
    const pages = groupsFor().flatMap(({ items }) => items);
    for (const [path, label] of [
      [base, "Overview"],
      [`${base}/edit`, "Overview"],
      [`${base}/documents`, "Documents"],
      [`${base}/workspaces/project`, "Project overview"],
      [`${base}/workspaces/project/milestones`, "Milestones"],
      [`${base}/workspaces/project/milestones/m-1`, "Milestones"],
      [`${base}/workspaces/hse/team`, "HSE team"],
    ]) {
      expect(activeNavChild(path, pages)?.label, path).toBe(label);
    }
  });
});

describe("contractBreadcrumbs", () => {
  const crumbs = (pathname: string) =>
    contractBreadcrumbs({
      companyName: "Acme",
      companyHref: "/dashboards",
      reference: "CTR-1",
      contractId: "c-1",
      pathname,
      groups: groupsFor({ pathname }),
    });
  const text = (pathname: string) => crumbs(pathname).map(({ label }) => label);

  it("follows company, register, contract, workspace and page", () => {
    expect(text(base)).toEqual(["Acme", "Contracts", "CTR-1"]);
    expect(text(`${base}/parties`)).toEqual([
      "Acme",
      "Contracts",
      "CTR-1",
      "Parties",
    ]);
    expect(text(`${base}/workspaces/project`)).toEqual([
      "Acme",
      "Contracts",
      "CTR-1",
      "Project",
    ]);
    expect(text(`${base}/workspaces/project/milestones/m-1`)).toEqual([
      "Acme",
      "Contracts",
      "CTR-1",
      "Project",
      "Milestones",
      "Details",
    ]);
    expect(text(`${base}/edit`)).toEqual([
      "Acme",
      "Contracts",
      "CTR-1",
      "Edit details",
    ]);
  });

  it("leaves only the current page unlinked", () => {
    const trail = crumbs(`${base}/workspaces/project/stages`);
    expect(trail.at(-1)?.href).toBeUndefined();
    expect(trail.slice(0, -1).every(({ href }) => href)).toBe(true);
  });
});
