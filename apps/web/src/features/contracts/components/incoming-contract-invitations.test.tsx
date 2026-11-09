import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EPartyType } from "@contractflow/contracts-schema";
import { IncomingContractInvitations } from "./incoming-contract-invitations";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("@/services/contractApi", () => ({
  useGetIncomingContractInvitationsQuery: mocks.list,
  useRespondToIncomingContractInvitationMutation: () => [
    vi.fn(),
    { isLoading: false, reset: vi.fn() },
  ],
}));
vi.mock("@/hooks/use-user-time-zone", () => ({ useUserTimeZone: () => "UTC" }));

const invitation = {
  id: "inv-1",
  contractTitle: "Trans-Delta pipeline integrity",
  contractReference: "CF-2026-0142",
  invitingCompanyName: "Atlantic Delta Petroleum",
  partyType: EPartyType.CONTRACTOR,
  email: "contracts@ridgeline.test",
  createdAt: "2026-11-08T10:00:00.000Z",
  expiresAt: "2026-11-15T10:00:00.000Z",
};

const render = () =>
  renderToStaticMarkup(<IncomingContractInvitations companyId="company-1" />);

describe("IncomingContractInvitations", () => {
  beforeEach(() => vi.resetAllMocks());

  it("asks for the header company's invitations", () => {
    mocks.list.mockReturnValue({ currentData: [] });
    render();
    expect(mocks.list).toHaveBeenCalledWith({ companyId: "company-1" });
  });

  it("takes no space when there is nothing to answer", () => {
    mocks.list.mockReturnValue({ currentData: [] });
    expect(render()).toBe("");
    mocks.list.mockReturnValue({ isLoading: true });
    expect(render()).toBe("");
  });

  it("lists each invitation with who sent it, the role offered and its expiry", () => {
    mocks.list.mockReturnValue({ currentData: [invitation] });
    const markup = render();
    expect(markup).toContain(">Invitations to contracts</h2>");
    expect(markup).toContain("Trans-Delta pipeline integrity");
    expect(markup).toContain(
      "CF-2026-0142 · from Atlantic Delta Petroleum · as Contractor",
    );
    // The date is formatted in the viewer's locale.
    expect(markup).toMatch(/Expires [^<]*2026/);
    expect(markup).toContain(
      'aria-label="Accept the invitation to Trans-Delta pipeline integrity"',
    );
    expect(markup).toContain(
      'aria-label="Decline the invitation to Trans-Delta pipeline integrity"',
    );
  });

  it("offers a retry when the invitations can't be loaded", () => {
    mocks.list.mockReturnValue({
      error: { status: 404, data: { message: "Company was not found." } },
      refetch: vi.fn(),
    });
    const markup = render();
    expect(markup).toContain("Company was not found.");
    expect(markup).toContain("Retry");
  });
});
