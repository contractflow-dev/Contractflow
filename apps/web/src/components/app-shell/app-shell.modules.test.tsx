// @vitest-environment jsdom
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RiBuilding4Line,
  RiFileList3Line,
  RiGroupLine,
  RiOrganizationChart,
} from "@remixicon/react";
import { AppShell } from "./app-shell";
import type { AppNavGroup } from "./navigation";

vi.setConfig({ testTimeout: 20_000 });
// jsdom has no matchMedia; the sidebar's useIsMobile reads innerWidth for
// its answer and only listens through this.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

const mocks = vi.hoisted(() => ({ pathname: "/dashboards" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));
// Links are plain anchors here; navigation is the route mock above.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        props.onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

const navigation: AppNavGroup[] = [
  {
    items: [
      {
        href: "/dashboards",
        label: "Overview",
        icon: RiBuilding4Line,
        match: "exact",
      },
      {
        href: "/dashboards/contracts",
        label: "Contracts",
        icon: RiFileList3Line,
        description: "Contracts your company is a party to.",
        children: [
          {
            href: "/dashboards/contracts",
            label: "Contract register",
            icon: RiFileList3Line,
          },
          {
            href: "/dashboards/contracts/new",
            label: "New contract",
            icon: RiFileList3Line,
            match: "exact",
          },
        ],
      },
      {
        href: "/dashboards/departments/project",
        label: "Departments",
        icon: RiOrganizationChart,
        children: [
          {
            href: "/dashboards/departments/project",
            label: "Project",
            icon: RiOrganizationChart,
          },
          {
            href: "/dashboards/departments/hse",
            label: "HSE",
            icon: RiOrganizationChart,
          }, // Opens a dialog over the page that is open.
          {
            href: "/dashboards/departments/project",
            label: "Staffing",
            icon: RiOrganizationChart,
            dialog: "staffing",
          },
        ],
      },
      { href: "/dashboards/team", label: "Team", icon: RiGroupLine },
    ],
  },
];

function Shell() {
  return (
    <AppShell
      navigationLabel="Company dashboard"
      brand={<span>Brand</span>}
      navigation={navigation}
      header={<p>Header</p>}
    >
      <p>Page content</p>
    </AppShell>
  );
}

/** Renders at `pathname`; `go` moves to another route, as a link, a refresh or back and forward would. */
function setup(pathname: string) {
  mocks.pathname = pathname;
  const user = userEvent.setup({ delay: null });
  const view = render(<Shell />);
  const go = (next: string) => {
    mocks.pathname = next;
    view.rerender(<Shell />);
  };
  return { user, go };
}

const sidebarContainer = () =>
  document.querySelector<HTMLElement>('[data-slot="sidebar-container"]')!;
const sidebarState = () =>
  document.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state");
const modules = () =>
  screen.getByRole("navigation", { name: "Company dashboard" });
const pagesNav = (module: string) =>
  screen.queryByRole("navigation", { name: `${module} pages` });

function setWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}

beforeEach(() => setWidth(1280));
afterEach(cleanup);

describe("desktop navigation", () => {
  it("shows the modules in full, without a module sidebar, on a page that stands alone", () => {
    setup("/dashboards");

    expect(sidebarState()).toBe("expanded");
    expect(pagesNav("Contracts")).toBeNull();
    expect(
      within(modules())
        .getByRole("link", { name: "Overview" })
        .getAttribute("aria-current"),
    ).toBe("page");
    // Nothing to fold back to: no rail toggle.
    expect(screen.queryByRole("button", { name: /navigation/ })).toBeNull();
  });

  it("opens straight into a module from a direct link or a refresh: rail, its pages, the current one", () => {
    setup("/dashboards/contracts/01J0000000000000000000000A/parties");

    expect(sidebarState()).toBe("collapsed");
    const pages = pagesNav("Contracts")!;
    expect(
      within(pages).getByText("Contracts your company is a party to."),
    ).toBeTruthy();
    expect(
      within(pages)
        .getByRole("link", { name: "Contract register" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(pages)
        .getByRole("link", { name: "New contract" })
        .getAttribute("aria-current"),
    ).toBeNull();
    // The rail keeps every module, named, with the open one marked.
    const contracts = within(modules()).getByRole("link", {
      name: "Contracts",
    });
    expect(contracts.getAttribute("aria-current")).toBe("true");
    expect(within(modules()).getByRole("link", { name: "Team" })).toBeTruthy();
  });

  it("marks only the most specific page current", () => {
    setup("/dashboards/contracts/new");
    const current = within(pagesNav("Contracts")!)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual(["New contract"]);
  });

  it("links a dialog entry to the open page with ?dialog=, never as the current page", () => {
    setup("/dashboards/departments/hse");
    const staffing = within(pagesNav("Departments")!).getByRole("link", {
      name: "Staffing",
    });
    expect(staffing.getAttribute("href")).toBe(
      "/dashboards/departments/hse?dialog=staffing",
    );
    expect(staffing.getAttribute("aria-haspopup")).toBe("dialog");
    expect(staffing.getAttribute("aria-current")).toBeNull();
    expect(
      within(pagesNav("Departments")!)
        .getByRole("link", { name: "HSE" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("swaps the module sidebar when the route moves to another module, and closes it on the overview", () => {
    const { go } = setup("/dashboards/contracts");
    expect(pagesNav("Contracts")).toBeTruthy();

    go("/dashboards/departments/hse");
    expect(sidebarState()).toBe("collapsed");
    expect(pagesNav("Contracts")).toBeNull();
    expect(
      within(pagesNav("Departments")!)
        .getByRole("link", { name: "HSE" })
        .getAttribute("aria-current"),
    ).toBe("page");

    // Back, as the browser's back button would.
    go("/dashboards/contracts");
    expect(pagesNav("Departments")).toBeNull();
    expect(pagesNav("Contracts")).toBeTruthy();

    go("/dashboards");
    expect(sidebarState()).toBe("expanded");
    expect(pagesNav("Contracts")).toBeNull();
  });

  it("lets the user expand the rail, keeps that within the module, and folds it for the next module", async () => {
    const { user, go } = setup("/dashboards/contracts");

    const expand = screen.getByRole("button", { name: "Expand navigation" });
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    await user.click(expand);
    expect(sidebarState()).toBe("expanded");
    const collapse = screen.getByRole("button", {
      name: "Collapse navigation",
    });
    expect(collapse.getAttribute("aria-expanded")).toBe("true");
    // The module's pages stay beside it.
    expect(pagesNav("Contracts")).toBeTruthy();

    go("/dashboards/contracts/new");
    expect(sidebarState()).toBe("expanded");

    // Clicking left the pointer over the rail; move it away first, or the
    // rail would stay open as a hover peek.
    await user.unhover(sidebarContainer());
    go("/dashboards/departments/project");
    expect(sidebarState()).toBe("collapsed");

    await user.click(screen.getByRole("button", { name: "Expand navigation" }));
    await user.click(
      screen.getByRole("button", { name: "Collapse navigation" }),
    );
    await user.unhover(sidebarContainer());
    expect(sidebarState()).toBe("collapsed");
  });

  it("opens the rail in full while hovered, over the module sidebar, without moving the page", async () => {
    const { user } = setup("/dashboards/contracts");
    const wrapper = document.querySelector('[data-slot="sidebar-wrapper"]')!;
    expect(sidebarState()).toBe("collapsed");

    await user.hover(sidebarContainer());
    expect(sidebarState()).toBe("expanded");
    // Peeking: the rail's space in the layout stays rail-sized, so it
    // overlays the module pages, which stay where they are.
    expect(wrapper.getAttribute("data-peek")).toBe("true");
    expect(wrapper.className).toContain(
      "data-[peek=true]:**:data-[slot=sidebar-gap]:w-(--sidebar-width-icon)",
    );
    expect(pagesNav("Contracts")).toBeTruthy();
    // A peek isn't a pinned rail.
    expect(
      screen
        .getByRole("button", { name: "Expand navigation" })
        .getAttribute("aria-expanded"),
    ).toBe("false");

    await user.unhover(sidebarContainer());
    expect(sidebarState()).toBe("collapsed");
    expect(wrapper.getAttribute("data-peek")).toBeNull();
  });

  it("doesn't peek on a page that stands alone, where the sidebar is already open", async () => {
    const { user } = setup("/dashboards");
    await user.hover(sidebarContainer());
    expect(
      document
        .querySelector('[data-slot="sidebar-wrapper"]')!
        .getAttribute("data-peek"),
    ).toBeNull();
    expect(sidebarState()).toBe("expanded");
  });

  it("styles the module sidebar with the main sidebar's colours", () => {
    setup("/dashboards/contracts");
    const aside = pagesNav("Contracts")!.closest("aside")!;
    expect(aside.className).toContain("bg-sidebar");
    expect(aside.className).toContain("text-sidebar-foreground");
    expect(aside.className).toContain("border-sidebar-border");
    const current = within(pagesNav("Contracts")!).getByRole("link", {
      name: "Contract register",
    });
    expect(current.className).toContain("bg-sidebar-accent");
    expect(current.className).toContain("text-sidebar-accent-foreground");
  });

  it("shows only icons in the rail: labels hidden from view but still naming each link", () => {
    setup("/dashboards/contracts");
    expect(sidebarState()).toBe("collapsed");

    for (const name of ["Overview", "Contracts", "Departments", "Team"]) {
      const link = within(modules()).getByRole("link", { name });
      const label = within(link).getByText(name);
      // Visually hidden only in the collapsed rail (sr-only), so the link
      // keeps its accessible name.
      expect(label.className).toContain(
        "group-data-[collapsible=icon]:sr-only",
      );
    }
    const toggle = screen.getByRole("button", { name: "Expand navigation" });
    expect(within(toggle).getByText("Expand navigation").className).toContain(
      "group-data-[collapsible=icon]:sr-only",
    );
  });

  it("removes group labels from the rail entirely", () => {
    mocks.pathname = "/dashboards/contracts";
    render(
      <AppShell
        navigationLabel="Company dashboard"
        brand={<span>Brand</span>}
        navigation={[{ label: "Workspace", items: navigation[0].items }]}
        header={<p>Header</p>}
      >
        <p>Page content</p>
      </AppShell>,
    );
    expect(screen.getByText("Workspace").className).toContain(
      "group-data-[collapsible=icon]:hidden",
    );
  });

  it("reaches every module and page from the keyboard", async () => {
    const { user } = setup("/dashboards/contracts");
    const visited: string[] = [];
    for (let step = 0; step < 12; step += 1) {
      await user.tab();
      const active = document.activeElement;
      if (active instanceof HTMLAnchorElement) {
        visited.push(active.textContent ?? "");
      }
    }
    expect(visited).toEqual(
      expect.arrayContaining([
        "Overview",
        "Contracts",
        "Departments",
        "Team",
        "Contract register",
        "New contract",
      ]),
    );
  });
});

describe("mobile navigation", () => {
  beforeEach(() => setWidth(375));

  async function openDrawer(user: ReturnType<typeof userEvent.setup>) {
    await act(async () => undefined);
    await user.click(
      screen.getByRole("button", { name: "Open company dashboard menu" }),
    );
    return screen.findByRole("dialog");
  }

  it("shows no module sidebar beside the page", async () => {
    setup("/dashboards/contracts");
    await act(async () => undefined);
    expect(pagesNav("Contracts")).toBeNull();
  });

  it("opens on the current module's pages, goes back to the modules, and into another module", async () => {
    const { user } = setup("/dashboards/contracts");
    const drawer = await openDrawer(user);

    const pages = within(drawer).getByRole("navigation", {
      name: "Contracts pages",
    });
    expect(
      within(pages)
        .getByRole("link", { name: "Contract register" })
        .getAttribute("aria-current"),
    ).toBe("page");

    await user.click(
      within(drawer).getByRole("button", { name: /All of company dashboard/ }),
    );
    const list = within(drawer).getByRole("navigation", {
      name: "Company dashboard",
    });
    // A module opens its pages; a standalone page is a link.
    expect(within(list).getByRole("link", { name: "Team" })).toBeTruthy();
    await user.click(
      within(list).getByRole("button", {
        name: /^Departments\W+show its pages$/,
      }),
    );
    expect(
      within(drawer).getByRole("navigation", { name: "Departments pages" }),
    ).toBeTruthy();
  });

  it("closes the drawer when a page is chosen", async () => {
    const { user } = setup("/dashboards/contracts");
    const drawer = await openDrawer(user);

    await user.click(
      within(drawer).getByRole("link", { name: "New contract" }),
    );
    await act(async () => undefined);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
