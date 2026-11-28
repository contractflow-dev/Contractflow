// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EPartyType } from "@contractflow/contracts-schema";
import { InviteCompanyDialog } from "./invite-company-dialog";

const mocks = vi.hoisted(() => ({ create: vi.fn(), notify: vi.fn() }));

vi.mock("@/services/contractApi", () => ({
  useCreateContractPartyInvitationMutation: () => [
    mocks.create,
    { isLoading: false },
  ],
}));
vi.mock("@/lib/notify", () => ({ notifySuccess: mocks.notify }));

function setup({ subcontract = false } = {}) {
  const onOpenChange = vi.fn();
  render(
    <InviteCompanyDialog
      companyId="company-1"
      contract={{
        id: "contract-1",
        referenceNumber: "CTR-1",
        title: "Pipeline",
      }}
      subcontract={subcontract}
      open
      onOpenChange={onOpenChange}
    />,
  );
  return { user: userEvent.setup({ delay: null }), onOpenChange };
}
const send = () => screen.getByRole("button", { name: "Send Invitation" });

beforeEach(() => {
  mocks.create.mockReset();
  mocks.notify.mockReset();
  mocks.create.mockReturnValue({ unwrap: () => Promise.resolve({}) });
});
afterEach(cleanup);

describe("InviteCompanyDialog", () => {
  it("names the contract the company is invited to", () => {
    setup();
    expect(
      screen.getByRole("dialog", { name: "Invite a company" }).textContent,
    ).toContain("CTR-1 · Pipeline");
  });

  it("validates the email at the field", async () => {
    const { user } = setup();
    await user.click(send());
    expect(screen.getByText("Enter an email address.")).toBeTruthy();

    await user.type(screen.getByLabelText(/Company email/), "not-an-email");
    await user.click(send());
    expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("sends through the existing workflow in this contract, then closes", async () => {
    const { user, onOpenChange } = setup();
    await user.type(screen.getByLabelText(/Company email/), " co@example.com ");
    // No party type to choose: an invited company is always the awarded party.
    expect(screen.queryByLabelText("Party type")).toBeNull();
    expect(screen.getByText(/joins this contract as the/)).toBeTruthy();
    await user.click(send());

    expect(mocks.create).toHaveBeenCalledWith({
      companyId: "company-1",
      contractId: "contract-1",
      email: "co@example.com",
      partyType: EPartyType.AWARDED,
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mocks.notify).toHaveBeenCalledOnce();
  });

  it("stays open with the API's reason, and claims no success", async () => {
    mocks.create.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          status: 409,
          data: { message: "That company is already a party." },
        }),
    });
    const { user, onOpenChange } = setup();
    await user.type(screen.getByLabelText(/Company email/), "co@example.com");
    await user.click(send());

    expect(
      await screen.findByText("That company is already a party."),
    ).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("closes on Cancel without sending", async () => {
    const { user, onOpenChange } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("on a subcontract", () => {
  it("invites the subcontractor, through the same workflow", async () => {
    const { user } = setup({ subcontract: true });
    expect(
      screen.getByRole("heading", { name: "Invite a subcontractor" }),
    ).toBeTruthy();
    expect(screen.getByText(/the subcontractor\./)).toBeTruthy();
    await user.type(screen.getByLabelText(/Company email/), "sub@example.com");
    await user.click(send());
    expect(mocks.create).toHaveBeenCalledWith({
      companyId: "company-1",
      contractId: "contract-1",
      email: "sub@example.com",
      partyType: EPartyType.AWARDED,
    });
  });
});
