import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_NAVIGATION } from "../admin-navigation";
import { AdminShell } from "./admin-shell";

const mocks = vi.hoisted(() => ({ pathname: "/admin" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("./admin-header", () => ({
  AdminHeader: () => <p>Admin header</p>,
}));

describe("AdminShell", () => {
  beforeEach(() => {
    mocks.pathname = "/admin";
  });

  it("renders the platform admin navigation in the shared shell", () => {
    const markup = renderToStaticMarkup(
      <AdminShell>
        <p>Overview page</p>
      </AdminShell>,
    );

    expect(markup).toContain('<nav aria-label="Platform admin navigation">');
    expect(markup).toContain("Admin header");
    expect(markup).toMatch(/<main[^>]*>[\s\S]*Overview page/);
    // The only built destination is a link, marked as the current page.
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toMatch(/href="\/admin"[^>]*>[\s\S]*?Overview/);
    expect(markup).toContain('href="/dashboards"');
  });

  it("keeps every existing group and lists unbuilt modules as planned", () => {
    const markup = renderToStaticMarkup(
      <AdminShell>
        <p>Overview page</p>
      </AdminShell>,
    );

    for (const group of ADMIN_NAVIGATION) {
      expect(markup).toContain(`>${group.label?.replace("&", "&amp;")}</div>`);
    }
    const planned = ADMIN_NAVIGATION.flatMap((group) => group.items).filter(
      (item) => item.plannedNote,
    );
    expect(planned).toHaveLength(12);
    for (const item of planned) {
      expect(markup).not.toContain(`href="${item.href}"`);
    }
    expect(markup.match(/>Planned</g)).toHaveLength(12);
  });
});
