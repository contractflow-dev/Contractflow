import { RiFileList3Line } from "@remixicon/react";
import { describe, expect, it } from "vitest";
import {
  activeNavChild,
  activeNavModule,
  flattenNavItems,
  isNavItemActive,
  type AppNavGroup,
  type AppNavItem,
} from "./navigation";

const icon = RiFileList3Line;
const register: AppNavItem = {
  href: "/dashboards/contracts",
  label: "Contract register",
  icon,
};
const newContract: AppNavItem = {
  href: "/dashboards/contracts/new",
  label: "New contract",
  icon,
  match: "exact",
};
const mine: AppNavItem = {
  href: "/dashboards/my-contracts",
  label: "My contracts",
  icon,
};
const contracts: AppNavItem = {
  href: "/dashboards/contracts",
  label: "Contracts",
  icon,
  children: [register, newContract, mine],
};
const overview: AppNavItem = {
  href: "/dashboards",
  label: "Overview",
  icon,
  match: "exact",
};
const groups: AppNavGroup[] = [{ items: [overview, contracts] }];

describe("activeNavChild", () => {
  it("picks the most specific page, so only one is ever current", () => {
    const pages = contracts.children!;
    expect(activeNavChild("/dashboards/contracts", pages)).toBe(register);
    expect(activeNavChild("/dashboards/contracts/new", pages)).toBe(
      newContract,
    );
    expect(activeNavChild("/dashboards/my-contracts", pages)).toBe(mine);
  });

  it("keeps a contract's own nested and dynamic pages under the register", () => {
    const pages = contracts.children!;
    for (const path of [
      "/dashboards/contracts/01J0000000000000000000000A",
      "/dashboards/contracts/01J0000000000000000000000A/parties",
      "/dashboards/contracts/01J0000000000000000000000A/workspaces/hse/team",
    ]) {
      expect(activeNavChild(path, pages), path).toBe(register);
    }
  });

  it("never matches on a shared prefix alone", () => {
    expect(
      activeNavChild("/dashboards/contracts-archive", contracts.children!),
    ).toBeNull();
    expect(
      activeNavChild("/dashboards/contracts/newer", [newContract]),
    ).toBeNull();
  });
});

describe("activeNavModule", () => {
  it("finds the module a page belongs to, through any of its pages", () => {
    expect(activeNavModule("/dashboards/contracts/abc", groups)).toBe(
      contracts,
    );
    expect(activeNavModule("/dashboards/my-contracts", groups)).toBe(contracts);
  });

  it("has no module on pages that stand alone, or that it doesn't know", () => {
    expect(activeNavModule("/dashboards", groups)).toBeNull();
    expect(activeNavModule("/dashboards/team", groups)).toBeNull();
  });

  it("ignores a planned module", () => {
    expect(
      activeNavModule("/dashboards/contracts", [
        { items: [{ ...contracts, plannedNote: "Planned" }] },
      ]),
    ).toBeNull();
  });
});

describe("isNavItemActive with modules", () => {
  it("marks a module active on any of its pages", () => {
    expect(isNavItemActive("/dashboards/my-contracts", contracts)).toBe(true);
    expect(isNavItemActive("/dashboards", contracts)).toBe(false);
  });
});

describe("flattenNavItems", () => {
  it("lists modules with their pages, for route-wide checks", () => {
    expect(flattenNavItems([overview, contracts]).map((i) => i.label)).toEqual([
      "Overview",
      "Contracts",
      "Contract register",
      "New contract",
      "My contracts",
    ]);
  });
});
