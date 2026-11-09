import { describe, expect, it } from "vitest";
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
          "Reports",
        ],
      },
      {
        label: "Department workspaces",
        items: ["Contractor", "Client Project Mgmt", "HSE", "Finance"],
      },
      {
        label: undefined,
        items: ["Team", "Company profile", "Help & Support"],
      },
    ]);
  });

  it("hides administrator pages from members", () => {
    const items = companyNavigationFor(false).flatMap((group) => group.items);
    expect(items.map((item) => item.label)).not.toContain("Overview");
    expect(items.map((item) => item.label)).not.toContain("Team");
    expect(items.map((item) => item.label)).toContain("Contracts");
  });

  it("marks every unbuilt destination as planned, so none links anywhere", () => {
    const planned = COMPANY_NAVIGATION.filter((item) => item.plannedNote);
    expect(planned.map((item) => item.label)).toEqual([
      "Tasks",
      "Calendar",
      "Reports",
      "Contractor",
      "Client Project Mgmt",
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
