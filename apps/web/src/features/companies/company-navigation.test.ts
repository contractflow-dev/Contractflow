import { describe, expect, it } from "vitest";
import {
  activeNavChild,
  activeNavModule,
} from "@/components/app-shell/navigation";
import {
  COMPANY_NAVIGATION,
  companyNavigationFor,
  isCompanyAdminRoute,
} from "./company-navigation";

const labels = (groups: ReturnType<typeof companyNavigationFor>) =>
  groups.map(({ label, items }) => ({
    label,
    items: items.map((item) => item.label),
  }));

describe("company navigation", () => {
  it("groups only built, company-owned destinations", () => {
    expect(labels(companyNavigationFor(true))).toEqual([
      { label: undefined, items: ["Overview"] },
      { label: undefined, items: ["Contracts"] },
      { label: "Company", items: ["Documents", "Team", "Settings"] },
    ]);
    expect(labels(companyNavigationFor(false))).toEqual([
      { label: undefined, items: ["Contracts"] },
      { label: "Company", items: ["Documents"] },
    ]);
  });

  it("gives Contracts its pages, with New Contract only for administrators", () => {
    const contracts = (canManage: boolean) =>
      companyNavigationFor(canManage)
        .flatMap(({ items }) => items)
        .find(({ label }) => label === "Contracts")!;

    expect(
      contracts(true).children!.map(({ label, href }) => ({ label, href })),
    ).toEqual([
      { label: "All Contracts", href: "/dashboards/contracts" },
      { label: "New Contract", href: "/dashboards/contracts/new" },
    ]);
    expect(contracts(false).children!.map(({ label }) => label)).toEqual([
      "All Contracts",
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

  it("lists no department or workspace, for anyone", () => {
    for (const canManage of [true, false]) {
      const items = companyNavigationFor(canManage).flatMap(({ items }) =>
        items.flatMap((item) => [item, ...(item.children ?? [])]),
      );
      for (const item of items) {
        expect(item.href, item.label).not.toContain("/departments");
        expect(item.href, item.label).not.toContain("/workspaces");
      }
    }
  });

  it("gives administrators Company Settings, with the company profile at its URL", () => {
    const settings = companyNavigationFor(true)
      .flatMap(({ items }) => items)
      .find(({ label }) => label === "Settings")!;
    expect(
      settings.children!.map(({ label, href }) => ({ label, href })),
    ).toEqual([{ label: "Company Profile", href: "/dashboards/profile" }]);
    expect(
      companyNavigationFor(false)
        .flatMap(({ items }) => items)
        .some(({ label }) => label === "Settings"),
    ).toBe(false);
    expect(isCompanyAdminRoute("/dashboards/profile")).toBe(true);
  });

  it("keeps the unlisted department pages for administrators only", () => {
    expect(isCompanyAdminRoute("/dashboards/departments")).toBe(true);
    expect(isCompanyAdminRoute("/dashboards/departments/hse")).toBe(true);
    expect(isCompanyAdminRoute("/dashboards/departments-other")).toBe(false);
    expect(isCompanyAdminRoute("/dashboards/contracts")).toBe(false);
    expect(isCompanyAdminRoute("/dashboards/contracts/new")).toBe(true);
    expect(isCompanyAdminRoute("/dashboards/team")).toBe(true);
  });

  it("hides administrator pages from members, in modules too", () => {
    const items = companyNavigationFor(false).flatMap((group) =>
      group.items.flatMap((item) => [item, ...(item.children ?? [])]),
    );
    const labels = items.map((item) => item.label);
    expect(labels).not.toContain("Overview");
    expect(labels).not.toContain("Team");
    expect(labels).not.toContain("New Contract");
    expect(labels).toContain("Contracts");
  });

  it("treats every module page an administrator may open as an administrator route", () => {
    const adminOnly = COMPANY_NAVIGATION.filter(
      (item) => item.adminOnly && !item.plannedNote,
    ).map((item) => item.href);
    expect(adminOnly).toContain("/dashboards/contracts/new");
    expect(adminOnly).toContain("/dashboards/team/contract-roles");
    expect(adminOnly).not.toContain("/dashboards/contracts");
  });

  it("lists no unbuilt destination, and every entry is a dashboard page", () => {
    for (const item of COMPANY_NAVIGATION) {
      expect(item.plannedNote, item.label).toBeUndefined();
      expect(item.href.startsWith("/dashboards"), item.label).toBe(true);
    }
  });
});
