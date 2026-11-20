// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamDialogs } from "./team-dialogs";

vi.setConfig({ testTimeout: 20_000 });

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: "",
  invitations: vi.fn(),
  revoke: vi.fn(),
  resend: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  usePathname: () => "/dashboards/team/contract-roles",
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock("@/features/companies", () => ({
  useGetCompanyInvitationsQuery: mocks.invitations,
  useRevokeCompanyInvitationMutation: () => [
    mocks.revoke,
    { isLoading: false },
  ],
  useResendCompanyInvitationMutation: () => [mocks.resend],
  useInviteCompanyMemberMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock("@/hooks/use-user-time-zone", () => ({ useUserTimeZone: () => "UTC" }));
vi.mock("@/lib/notify", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

const meta = {
  totalItems: 1,
  itemCount: 1,
  itemsPerPage: 10,
  totalPages: 1,
  currentPage: 1,
};

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "invitation-1",
    email: "person@example.com",
    firstName: null,
    lastName: null,
    companyRole: "Member",
    status: "pending",
    expiresAt: "2099-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function listing(data: unknown[]) {
  mocks.invitations.mockReturnValue({
    currentData: { data, meta: { ...meta, totalItems: data.length } },
    isFetching: false,
    isLoading: false,
    error: undefined,
    refetch: vi.fn(),
  });
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.replace.mockReset();
  mocks.invitations.mockReset();
  mocks.revoke.mockReset();
  mocks.search = "";
  listing([invitation()]);
});
afterEach(cleanup);

function setup(search = "") {
  mocks.search = search;
  const user = userEvent.setup({ delay: null });
  render(<TeamDialogs companyId="company-1" />);
  return user;
}

describe("TeamDialogs", () => {
  it("opens nothing, and loads nothing, without ?dialog=", () => {
    setup("workspace=hse");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.invitations).not.toHaveBeenCalled();
  });

  it("ignores an unknown dialog name", () => {
    setup("dialog=settings");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens Invite member from ?dialog=invite", () => {
    setup("dialog=invite");
    expect(
      screen.getByRole("dialog", { name: "Invite a team member" }),
    ).toBeTruthy();
  });

  it("lists invitations with the status legend from ?dialog=invitations", () => {
    listing([
      invitation(),
      invitation({
        id: "invitation-2",
        email: "late@example.com",
        expiresAt: "2020-01-01T00:00:00.000Z",
      }),
    ]);
    setup("dialog=invitations");

    const dialog = within(screen.getByRole("dialog", { name: "Invitations" }));
    expect(dialog.getByText("What do invitation statuses mean?")).toBeTruthy();
    expect(dialog.getByRole("table", { name: "Invitations" })).toBeTruthy();
    // A pending invitation can be revoked; an expired one only sent again.
    expect(dialog.getAllByRole("button", { name: "Revoke" })).toHaveLength(1);
    expect(
      dialog.getByRole("button", {
        name: "Send the invitation to late@example.com again",
      }),
    ).toBeTruthy();
    expect(dialog.getByText("Expired")).toBeTruthy();
    expect(mocks.invitations).toHaveBeenCalledWith({
      companyId: "company-1",
      page: 1,
      limit: 10,
    });
  });

  it.each([
    ["accepted", false],
    ["declined", false],
    ["revoked", false],
    ["expired", true],
  ])("offers Resend for a %s invitation: %s", (status, offered) => {
    listing([invitation({ status })]);
    setup("dialog=invitations");
    expect(
      screen.queryByRole("button", {
        name: "Send the invitation to person@example.com again",
      }) !== null,
    ).toBe(offered);
  });

  it("says when no invitations have been sent, and offers Retry on failure", () => {
    listing([]);
    setup("dialog=invitations");
    expect(screen.getByText("No invitations have been sent.")).toBeTruthy();
    cleanup();

    mocks.invitations.mockReturnValue({
      currentData: undefined,
      isFetching: false,
      isLoading: false,
      error: { status: 500, data: {} },
      refetch: vi.fn(),
    });
    setup("dialog=invitations");
    expect(screen.getByText(/^Invitations could not be loaded\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("closes by dropping ?dialog= and keeping the page's other parameters", async () => {
    const user = setup("workspace=hse&dialog=invitations");
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        "/dashboards/team/contract-roles?workspace=hse",
        { scroll: false },
      ),
    );
  });

  it("goes from Invitations to Invite member", async () => {
    const user = setup("dialog=invitations");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Invite member",
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith(
      "/dashboards/team/contract-roles?dialog=invite",
      { scroll: false },
    );
  });

  it("asks before revoking, inside the invitations dialog", async () => {
    mocks.revoke.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    const user = setup("dialog=invitations");
    await user.click(screen.getByRole("button", { name: "Revoke" }));

    const confirm = await screen.findByRole("alertdialog", {
      name: "Revoke this invitation?",
    });
    await user.click(
      within(confirm).getByRole("button", { name: "Revoke invitation" }),
    );
    expect(mocks.revoke).toHaveBeenCalledWith({
      companyId: "company-1",
      invitationId: "invitation-1",
    });
    // Revoking doesn't close the invitations list.
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
