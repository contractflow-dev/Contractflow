import { renderToStaticMarkup } from "react-dom/server";
import {
  cloneElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./account-menu";

const mocks = vi.hoisted(() => ({
  user: undefined as
    | {
        firstName: string;
        lastName: string;
        email: string;
        isPlatformAdmin: boolean;
      }
    | undefined,
}));

vi.mock("@/services/authApi", () => ({
  useGetCurrentUserQuery: () => ({ data: mocks.user }),
  useLogoutMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/store/hooks", () => ({ useAppDispatch: () => vi.fn() }));

// The real menu renders its items in a portal only while open; render them
// inline so the content can be checked.
vi.mock("@workspace/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  DropdownMenuItem: ({ children, ...props }: ComponentProps<"button">) => (
    <button role="menuitem" {...props}>
      {children}
    </button>
  ),
  DropdownMenuLinkItem: ({
    render,
    children,
  }: {
    render: ReactElement<{ role?: string }>;
    children: ReactNode;
  }) => cloneElement(render, { role: "menuitem" }, children),
}));

const admin = {
  firstName: "Pia",
  lastName: "Verifier",
  email: "pia@example.com",
  isPlatformAdmin: true,
};

describe("AccountMenu", () => {
  beforeEach(() => {
    mocks.user = { ...admin, isPlatformAdmin: false };
  });

  it("names the trigger and shows who is signed in", () => {
    const markup = renderToStaticMarkup(<AccountMenu area="company" />);

    expect(markup).toContain('aria-label="Open account menu"');
    expect(markup).toContain(">PV<");
    expect(markup).toContain("Pia Verifier");
    expect(markup).toContain("pia@example.com");
  });

  it("falls back to the email, then a generic label, when no name is known", () => {
    mocks.user = { ...admin, firstName: "", lastName: "" };
    const noName = renderToStaticMarkup(<AccountMenu area="company" />);
    expect(noName).toContain(">pia@example.com<");

    mocks.user = undefined;
    const loading = renderToStaticMarkup(<AccountMenu area="company" />);
    expect(loading).toContain("Your account");
  });

  it("always offers sign out through the shared sign-out action", () => {
    const markup = renderToStaticMarkup(<AccountMenu area="company" />);

    expect(markup).toContain('aria-label="Sign out of ContractFlow"');
    expect(markup).toMatch(/role="menuitem"[^>]*>[\s\S]*Sign out/);
  });

  it("offers platform administration only to platform administrators", () => {
    const member = renderToStaticMarkup(<AccountMenu area="company" />);
    expect(member).not.toContain('href="/admin"');
    expect(member).not.toContain("Platform administration");

    mocks.user = admin;
    const platformAdmin = renderToStaticMarkup(<AccountMenu area="company" />);
    expect(platformAdmin).toMatch(
      /<a[^>]*href="\/admin"[^>]*>[\s\S]*Platform administration/,
    );
  });

  it("links back to the company workspace from platform administration", () => {
    mocks.user = admin;
    const markup = renderToStaticMarkup(<AccountMenu area="admin" />);

    expect(markup).toMatch(
      /<a[^>]*href="\/dashboards"[^>]*>[\s\S]*Company workspace/,
    );
    expect(markup).not.toContain('href="/admin"');
  });

  it("shows no links to account features that don't exist yet", () => {
    mocks.user = admin;
    const markup = renderToStaticMarkup(<AccountMenu area="company" />);

    expect(markup).not.toMatch(/Profile|Settings|Password|Security|Sessions/);
    expect(markup.match(/role="menuitem"/g)).toHaveLength(2);
  });
});
