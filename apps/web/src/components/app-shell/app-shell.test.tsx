import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { RiFileList3Line, RiGroupLine } from "@remixicon/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";
import { isNavItemActive, type AppNavGroup } from "./navigation";

const mocks = vi.hoisted(() => ({ pathname: "/dashboards/contracts/abc" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

const navigation: AppNavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        href: "/dashboards",
        label: "Overview",
        icon: RiGroupLine,
        match: "exact",
      },
      {
        href: "/dashboards/contracts",
        label: "Contracts",
        icon: RiFileList3Line,
      },
    ],
  },
  {
    label: "Later",
    items: [
      {
        href: "/dashboards/reports",
        label: "Reports",
        icon: RiFileList3Line,
        plannedNote: "Reports module is planned",
      },
    ],
  },
];

function renderShell() {
  return renderToStaticMarkup(
    <AppShell
      navigationLabel="Company dashboard"
      brand={<span>Brand</span>}
      navigation={navigation}
      sidebarFooter={<p>Footer note</p>}
      header={<p>Header content</p>}
    >
      <p>Page content</p>
    </AppShell>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    mocks.pathname = "/dashboards/contracts/abc";
  });

  it("renders one labelled navigation landmark, a header and the main content", () => {
    const markup = renderShell();

    expect(markup.match(/<nav /g)).toHaveLength(1);
    expect(markup).toContain('<nav aria-label="Company dashboard">');
    expect(markup).toMatch(
      /<header[^>]*>[\s\S]*Header content[\s\S]*<\/header>/,
    );
    expect(markup).toMatch(/<main[^>]*>[\s\S]*Page content[\s\S]*<\/main>/);
    expect(markup).toContain("Brand");
    expect(markup).toContain("Footer note");
  });

  it("renders the groups with their labels and links", () => {
    const markup = renderShell();

    expect(markup).toContain(">Workspace</div>");
    expect(markup).toContain(">Later</div>");
    expect(markup).toContain('href="/dashboards"');
    expect(markup).toContain('href="/dashboards/contracts"');
  });

  it("marks the current section as the current page", () => {
    const markup = renderShell();

    expect(markup).toMatch(
      /<a[^>]*aria-current="page"[^>]*href="\/dashboards\/contracts"|<a[^>]*href="\/dashboards\/contracts"[^>]*aria-current="page"/,
    );
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("lists a planned module as disabled, never as a link", () => {
    const markup = renderShell();

    expect(markup).not.toContain('href="/dashboards/reports"');
    expect(markup).toMatch(
      /<button[^>]*disabled=""[^>]*title="Reports module is planned"/,
    );
    expect(markup).toContain(">Planned</div>");
  });

  it("gives the mobile menu button an accessible name and hides it from md", () => {
    const markup = renderShell();
    const trigger =
      /<button[^>]*data-sidebar="trigger"[^>]*>/.exec(markup)?.[0] ?? "";

    expect(trigger).toContain('aria-label="Open company dashboard menu"');
    expect(trigger).toContain('aria-expanded="false"');
    expect(trigger).toContain('aria-haspopup="dialog"');
    expect(trigger).toMatch(/class="[^"]*\bmd:hidden\b/);
    // The standard 40px icon button.
    expect(trigger).toMatch(/class="[^"]*\bsize-10\b/);
  });
});

describe("isNavItemActive", () => {
  const item = {
    href: "/dashboards/contracts",
    label: "Contracts",
    icon: RiFileList3Line,
  };

  it("matches a section and the pages under it", () => {
    expect(isNavItemActive("/dashboards/contracts", item)).toBe(true);
    expect(isNavItemActive("/dashboards/contracts/abc", item)).toBe(true);
    expect(isNavItemActive("/dashboards/contracts-archive", item)).toBe(false);
  });

  it("matches an exact item only on its own path", () => {
    const overview = { ...item, href: "/dashboards", match: "exact" as const };
    expect(isNavItemActive("/dashboards", overview)).toBe(true);
    expect(isNavItemActive("/dashboards/team", overview)).toBe(false);
  });

  it("never marks a planned module active", () => {
    expect(
      isNavItemActive("/dashboards/contracts", {
        ...item,
        plannedNote: "Planned",
      }),
    ).toBe(false);
  });
});

describe("layout boundaries", () => {
  const read = (path: string) =>
    readFileSync(new URL(path, import.meta.url), "utf8");

  it("keeps the authentication and onboarding layouts outside the shell", () => {
    for (const path of [
      "../../app/auth/layout.tsx",
      "../../app/onboarding/layout.tsx",
      "../../app/layout.tsx",
    ]) {
      expect(read(path), path).not.toMatch(
        /AppShell|AdminShell|CompanyAdminShell/,
      );
    }
  });

  it("renders the admin area through the shared shell from a server layout", () => {
    const layout = read("../../app/admin/layout.tsx");
    expect(layout).not.toContain('"use client"');
    expect(layout).toContain("<RequirePlatformAdmin>");
    expect(layout).toContain("<AdminShell>");
  });
});
