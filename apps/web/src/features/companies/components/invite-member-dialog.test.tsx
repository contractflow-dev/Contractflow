// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ECompanyRole } from "@contractflow/contracts-schema";
import { InviteMemberDialog } from "./invite-member-dialog";

vi.setConfig({ testTimeout: 20_000 });

const mocks = vi.hoisted(() => ({
  invite: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock("@/features/companies", () => ({
  useInviteCompanyMemberMutation: () => [mocks.invite, { isLoading: false }],
}));
vi.mock("@/lib/notify", () => ({ notifySuccess: mocks.notifySuccess }));

beforeEach(() => {
  mocks.invite.mockReset();
  mocks.notifySuccess.mockReset();
});
afterEach(cleanup);

function setup(open = true) {
  const onOpenChange = vi.fn();
  const user = userEvent.setup({ delay: null });
  render(
    <InviteMemberDialog
      companyId="company-1"
      open={open}
      onOpenChange={onOpenChange}
    />,
  );
  return { user, onOpenChange };
}

const dialog = () =>
  screen.getByRole("dialog", { name: "Invite a team member" });

describe("InviteMemberDialog", () => {
  it("renders nothing while closed", () => {
    setup(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("collects company membership only: email, optional names and a company role", () => {
    setup();

    const form = within(dialog());
    expect(form.getByLabelText(/Email/)).toBeTruthy();
    expect(form.getByLabelText("First name (optional)")).toBeTruthy();
    expect(form.getByLabelText("Last name (optional)")).toBeTruthy();
    // Company roles only, Member first; no contract role or workspace field.
    const role = form.getByLabelText("Company role") as HTMLSelectElement;
    expect([...role.options].map((option) => option.value)).toEqual([
      ECompanyRole.MEMBER,
      ECompanyRole.COMPANY_ADMIN,
    ]);
    expect(role.value).toBe(ECompanyRole.MEMBER);
    expect(form.queryByLabelText(/workspace/i)).toBeNull();
    // Explains what an invitation is, and that it expires.
    expect(dialog().textContent).toContain("expires after seven days");
    expect(dialog().textContent).toContain(
      "contract roles are assigned on each contract",
    );
  });

  it("sends the invitation, then closes and says so", async () => {
    mocks.invite.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    const { user, onOpenChange } = setup();

    await user.type(screen.getByLabelText(/Email/), "  Ada@Example.com ");
    await user.type(screen.getByLabelText("First name (optional)"), " Ada ");
    await user.selectOptions(
      screen.getByLabelText("Company role"),
      ECompanyRole.COMPANY_ADMIN,
    );
    await user.click(screen.getByRole("button", { name: "Send Invitation" }));

    expect(mocks.invite).toHaveBeenCalledWith({
      companyId: "company-1",
      data: {
        email: "ada@example.com",
        firstName: "Ada",
        companyRole: ECompanyRole.COMPANY_ADMIN,
      },
    });
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mocks.notifySuccess).toHaveBeenCalledWith(
      "Invitation sent",
      "Ada@Example.com can now join the team.",
    );
  });

  it("keeps the dialog open with the reason when the invitation fails", async () => {
    mocks.invite.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          status: 409,
          data: { message: "This email already has a pending invitation." },
        }),
    });
    const { user, onOpenChange } = setup();

    await user.type(screen.getByLabelText(/Email/), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Send Invitation" }));

    expect(await within(dialog()).findByRole("alert")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("closes on Cancel without sending", async () => {
    const { user, onOpenChange } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.invite).not.toHaveBeenCalled();
  });
});
