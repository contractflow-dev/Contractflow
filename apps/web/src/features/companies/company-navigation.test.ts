import { describe, expect, it } from "vitest";
import {
  activeNavChild,
  activeNavModule,
} from "@/components/app-shell/navigation";
import { COMPANY_NAVIGATION, companyNavigationFor } from "./company-navigation";

const labels = (groups: ReturnType<typeof companyNavigationFor>) =>
  groups.map(({ label, items }) => ({
    label,
    items: items.map((item) => item.label),
  }));

describe("company navigation", () => {
  it("follows the Overview layout: work, department workspaces, company", () => {
    expect(labels(companyNavigationFor(true))).toEqual([
      {
        label: undefined,
        items: [
          "Overview",
          "Contracts",
          "Company documents",
          "Tasks",
          "Calendar",
        ],
      },
      {
        label: "Department workspaces",
        items: ["Departments"],
      },
      {
        label: undefined,
        items: ["Team", "Company profile", "Help & Support"],
      },
    ]);
  });

  it("gives Contracts its pages, with New contract only for administrators", () => {
    const contracts = (canManage: boolean) =>
      companyNavigationFor(canManage)
        .flatMap(({ items }) => items)
        .find(({ label }) => label === "Contracts")!;

    expect(
      contracts(true).children!.map(({ label, href }) => ({ label, href })),
    ).toEqual([
      { label: "Contract register", href: "/dashboards/contracts" },
      { label: "New contract", href: "/dashboards/contracts/new" },
    ]);
    expect(contracts(false).children!.map(({ label }) => label)).toEqual([
      "Contract register",
    ]);
  });

  it("gives Team two pages and two dialogs, and a dialog is never the open page", () => {
    const groups = companyNavigationFor(true);
    const team = groups
      .flatMap(({ items }) => items)
      .find(({ label }) => label === "Team")!;
    expect(
      team.children!.map(({ label, href, dialog }) => ({
        label,
        href,
        dialog,
      })),
    ).toEqual([
      { label: "Company members", href: "/dashboards/team", dialog: undefined },
      {
        label: "Contract roles",
        href: "/dashboards/team/contract-roles",
        dialog: undefined,
      },
      { label: "Invitations", href: "/dashboards/team", dialog: "invitations" },
      { label: "Invite member", href: "/dashboards/team", dialog: "invite" },
    ]);

    expect(activeNavModule("/dashboards/team/contract-roles", groups)).toBe(
      team,
    );
    expect(activeNavChild("/dashboards/team", team.children!)?.label).toBe(
      "Company members",
    );
    expect(
      activeNavChild("/dashboards/team/contract-roles", team.children!)?.label,
    ).toBe("Contract roles");
  });

  it("gives administrators a Departments module of live pages, and members the planned items", () => {
    const department = (canManage: boolean) =>
      companyNavigationFor(canManage).find(
        ({ label }) => label === "Department workspaces",
      )!.items;

    const [module] = department(true);
    expect(module.label).toBe("Departments");
    expect(module.href).toBe("/dashboards/departments/project");
    expect(
      module.children!.map(({ label, href, plannedNote }) => ({
        label,
        href,
        planned: Boolean(plannedNote),
      })),
    ).toEqual([
      {
        label: "Project",
        href: "/dashboards/departments/project",
        planned: false,
      },
      { label: "HSE", href: "/dashboards/departments/hse", planned: false },
      {
        label: "Finance",
        href: "/dashboards/departments/finance",
        planned: false,
      },
    ]);
    expect(department(false).every(({ plannedNote }) => plannedNote)).toBe(
      true,
    );
    expect(department(false).map(({ label }) => label)).toEqual([
      "Project",
      "HSE",
      "Finance",
    ]);
  });

  it("hides administrator pages from members, in modules too", () => {
    const items = companyNavigationFor(false).flatMap((group) =>
      group.items.flatMap((item) => [item, ...(item.children ?? [])]),
    );
    const labels = items.map((item) => item.label);
    expect(labels).not.toContain("Overview");
    expect(labels).not.toContain("Team");
    expect(labels).not.toContain("Departments");
    expect(labels).not.toContain("New contract");
    expect(labels).toContain("Contracts");
  });

  it("treats every module page an administrator may open as an administrator route", () => {
    const adminOnly = COMPANY_NAVIGATION.filter(
      (item) => item.adminOnly && !item.plannedNote,
    ).map((item) => item.href);
    expect(adminOnly).toContain("/dashboards/contracts/new");
    expect(adminOnly).toContain("/dashboards/departments/hse");
    expect(adminOnly).toContain("/dashboards/team/contract-roles");
    expect(adminOnly).not.toContain("/dashboards/contracts");
  });

  it("marks every unbuilt destination as planned, so none links anywhere", () => {
    const planned = COMPANY_NAVIGATION.filter((item) => item.plannedNote);
    expect(planned.map((item) => item.label)).toEqual([
      "Tasks",
      "Calendar",
      "Project",
      "HSE",
      "Finance",
      "Help & Support",
    ]);
    for (const item of COMPANY_NAVIGATION) {
      expect(
        item.plannedNote
          ? item.href.startsWith("#planned-")
          : item.href.startsWith("/dashboards"),
        item.label,
      ).toBe(true);
    }
  });
});
