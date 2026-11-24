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
import {
  AssignMemberDialog,
  ContractRoleInvitationsSheet,
} from "./contract-role-dialogs";

window.PointerEvent ??= MouseEvent as unknown as typeof PointerEvent;

const mocks = vi.hoisted(() => ({
  assign: vi.fn(),
  create: vi.fn(),
  revoke: vi.fn(),
  invitations: vi.fn(),
  refetch: vi.fn(),
  members: vi.fn(),
  notify: vi.fn(),
}));

const ROLES: Record<string, string[]> = {
  project: ["Client Project Manager", "Client Site Engineer"],
  hse: ["HSE Officer", "HSE Manager"],
};

vi.mock("@/services/contractApi", () => ({
  useGetContractRoleManagementPermissionsQuery: ({
    workspace,
  }: {
    workspace: string;
  }) => ({
    data: {
      canManage: true,
      canGrantWorkspaceAdmin: true,
      roleSide: "client",
      roles: ROLES[workspace] ?? [],
    },
    isLoading: false,
  }),
  useGetContractRoleAssignmentMembersQuery: mocks.members,
  useGetContractRoleInvitationsQuery: mocks.invitations,
  useAssignContractRoleMutation: () => [mocks.assign, { isLoading: false }],
  useCreateContractRoleInvitationMutation: () => [
    mocks.create,
    { isLoading: false },
  ],
  useRevokeContractRoleInvitationMutation: () => [
    mocks.revoke,
    { isLoading: false },
  ],
}));
vi.mock("@/hooks/use-user-time-zone", () => ({
  useUserTimeZone: () => "UTC",
}));
vi.mock("@/lib/notify", () => ({ notifySuccess: mocks.notify }));

const scope = { companyId: "company-1", contractId: "contract-1" };
const ok = () => ({ unwrap: () => Promise.resolve({}) });
const refused = (message: string) => ({
  unwrap: () => Promise.reject({ status: 409, data: { message } }),
});

function invitation(id: string, status: string, email = `${id}@example.com`) {
  return {
    id,
    email,
    role: "HSE Officer",
    workspace: "hse",
    isWorkspaceAdmin: false,
    status,
    createdAt: "2026-11-01T10:00:00.000Z",
    expiresAt: "2099-11-08T10:00:00.000Z",
    respondedAt: null,
    revokedAt: null,
  };
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.assign.mockReturnValue(ok());
  mocks.create.mockReturnValue(ok());
  mocks.revoke.mockReturnValue(ok());
  mocks.members.mockReturnValue({
    data: [
      { id: "m-1", firstName: "Ada", lastName: "Obi", email: "ada@x.com" },
    ],
    isFetching: false,
  });
  mocks.invitations.mockReturnValue({
    data: [invitation("i-1", "pending"), invitation("i-2", "accepted")],
    isLoading: false,
    refetch: mocks.refetch,
  });
});
afterEach(cleanup);

describe("AssignMemberDialog", () => {
  function setup(workspaces: Array<"project" | "hse"> = ["project", "hse"]) {
    const onOpenChange = vi.fn();
    render(
      <AssignMemberDialog
        {...scope}
        workspaces={workspaces}
        initialWorkspace={workspaces[0]}
        open
        onOpenChange={onOpenChange}
      />,
    );
    return { user: userEvent.setup({ delay: null }), onOpenChange };
  }
  const submit = () => screen.getByRole("button", { name: "Assign Member" });

  it("lists eligible members and only the workspaces it was given", () => {
    setup();
    const member = screen.getByLabelText(/Company member/) as HTMLSelectElement;
    expect([...member.options].map((o) => o.value)).toEqual(["", "m-1"]);
    const workspace = screen.getByLabelText("Workspace") as HTMLSelectElement;
    expect([...workspace.options].map((o) => o.value)).toEqual([
      "project",
      "hse",
    ]);
  });

  it("hides the workspace picker when there's only one", () => {
    setup(["hse"]);
    expect(screen.queryByLabelText("Workspace")).toBeNull();
  });

  it("offers the chosen workspace's roles", async () => {
    const { user } = setup();
    await user.selectOptions(screen.getByLabelText("Workspace"), "hse");
    const role = screen.getByLabelText("Contract role") as HTMLSelectElement;
    expect([...role.options].map((o) => o.value)).toEqual(ROLES.hse);
  });

  it("requires a member before sending", async () => {
    const { user } = setup();
    await user.click(submit());
    expect(screen.getByText("Select a company member.")).toBeTruthy();
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it("assigns through the existing workflow, then closes and says so", async () => {
    const { user, onOpenChange } = setup();
    await user.selectOptions(screen.getByLabelText("Workspace"), "hse");
    await user.selectOptions(screen.getByLabelText(/Company member/), "m-1");
    await user.selectOptions(
      screen.getByLabelText("Contract role"),
      "HSE Manager",
    );
    await user.click(submit());

    expect(mocks.assign).toHaveBeenCalledWith({
      ...scope,
      workspace: "hse",
      companyUserId: "m-1",
      role: "HSE Manager",
      isWorkspaceAdmin: false,
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mocks.notify).toHaveBeenCalledOnce();
  });

  it("stays open with the API's reason when it refuses", async () => {
    mocks.assign.mockReturnValue(refused("Already assigned."));
    const { user, onOpenChange } = setup();
    await user.selectOptions(screen.getByLabelText(/Company member/), "m-1");
    await user.click(submit());

    expect(await screen.findByText("Already assigned.")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("closes on Cancel without assigning", async () => {
    const { user, onOpenChange } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it("can't submit when no member is eligible", () => {
    mocks.members.mockReturnValue({ data: [], isFetching: false });
    setup();
    expect(screen.getByText(/No active company members/)).toBeTruthy();
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("ContractRoleInvitationsSheet", () => {
  function setup() {
    const onOpenChange = vi.fn();
    render(
      <ContractRoleInvitationsSheet
        {...scope}
        workspaces={["hse"]}
        initialWorkspace="hse"
        contractLabel="CTR-1 · Pipeline"
        open
        onOpenChange={onOpenChange}
      />,
    );
    return { user: userEvent.setup({ delay: null }), onOpenChange };
  }
  const row = (email: string) =>
    screen.getByText(email).closest("li") as HTMLElement;

  it("opens as a panel naming the contract, with each invitation's details", () => {
    setup();
    const panel = screen.getByRole("dialog", {
      name: "Contract Role Invitations",
    });
    expect(panel.textContent).toContain("CTR-1 · Pipeline");
    const pending = row("i-1@example.com");
    expect(pending.textContent).toContain("HSE Officer");
    expect(pending.textContent).toContain("Invited");
    expect(pending.textContent).toContain("Expires");
    expect(mocks.invitations).toHaveBeenCalledWith(
      { ...scope, workspace: "hse" },
      { skip: false },
    );
  });

  it("offers Revoke only on a pending invitation, and no unsupported actions", () => {
    setup();
    expect(
      within(row("i-1@example.com")).getByRole("button", { name: /Revoke/ }),
    ).toBeTruthy();
    expect(within(row("i-2@example.com")).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("button", { name: /Resend/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Accept/ })).toBeNull();
  });

  it("confirms a revocation in its row, without another dialog", async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole("button", {
        name: "Revoke invitation for i-1@example.com",
      }),
    );
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(mocks.revoke).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirm revoke" }));
    expect(mocks.revoke).toHaveBeenCalledWith({
      ...scope,
      workspace: "hse",
      invitationId: "i-1",
    });
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledOnce());
  });

  it("keeps the confirmation open with the API's reason on failure", async () => {
    mocks.revoke.mockReturnValue(refused("Already accepted."));
    const { user } = setup();
    await user.click(
      screen.getByRole("button", {
        name: "Revoke invitation for i-1@example.com",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Confirm revoke" }));
    expect(await screen.findByText("Already accepted.")).toBeTruthy();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("validates the email, then sends the invitation", async () => {
    const { user } = setup();
    const send = screen.getByRole("button", { name: "Send Invitation" });
    await user.click(send);
    expect(screen.getByText("Enter an email address.")).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Invitee email/), "bo@example.com");
    await user.click(
      screen.getByRole("checkbox", {
        name: "Invite as a workspace administrator",
      }),
    );
    await user.click(send);
    expect(mocks.create).toHaveBeenCalledWith({
      ...scope,
      workspace: "hse",
      email: "bo@example.com",
      role: "HSE Officer",
      isWorkspaceAdmin: true,
    });
  });

  it("shows loading, empty and error states", async () => {
    mocks.invitations.mockReturnValue({ isLoading: true });
    setup();
    expect(screen.getByText("Loading invitations…")).toBeTruthy();
    cleanup();

    mocks.invitations.mockReturnValue({ data: [], isLoading: false });
    setup();
    expect(screen.getByText(/No invitations have been sent/)).toBeTruthy();
    cleanup();

    mocks.invitations.mockReturnValue({
      error: { status: 500, data: {} },
      isLoading: false,
      refetch: mocks.refetch,
    });
    const { user } = setup();
    expect(screen.getByText(/Unable to load/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
});
