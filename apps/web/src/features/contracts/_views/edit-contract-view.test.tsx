// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  EContractStatus,
  EContractType,
  ECurrencyCode,
  EPartyType,
} from "@contractflow/contracts-schema";
import type { Contract } from "@/services/contractApi";
import { EditContractPage } from "./edit-contract-view";

vi.setConfig({ testTimeout: 30_000 });

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  update: vi.fn(),
  detail: {} as Record<string, unknown>,
  permissions: {} as Record<string, unknown>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
}));
vi.mock("@/services/contractApi", () => ({
  useGetContractByIdQuery: () => mocks.detail,
  useGetContractLifecyclePermissionsQuery: () => mocks.permissions,
  useUpdateContractMutation: () => [mocks.update, { isLoading: false }],
}));
vi.mock("@/lib/notify", () => ({ notifySuccess: vi.fn() }));

function contract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract-1",
    referenceNumber: "CTR-001",
    title: "Pipeline maintenance",
    description: null,
    contractType: EContractType.MAINTENANCE,
    status: EContractStatus.DRAFT,
    parentContractId: null,
    originalValueMinor: "150000050",
    currentValueMinor: "150000050",
    currencyCode: ECurrencyCode.NGN,
    retentionRateBps: 500,
    advancePaymentRateBps: null,
    paymentTermsDays: 30,
    liquidatedDamagesPerDayMinor: null,
    awardDate: "2026-01-01T00:00:00.000Z",
    startDate: "2026-02-01T00:00:00.000Z",
    endDate: "2026-12-31T00:00:00.000Z",
    revisedEndDate: null,
    defectsLiabilityDays: 365,
    timezone: "UTC",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function loaded(
  value: Contract,
  canManage = true,
  parentContract: Record<string, string> | null = null,
) {
  mocks.detail = {
    isLoading: false,
    error: undefined,
    currentData: {
      contract: value,
      membership: { partyType: EPartyType.AWARDING },
      parentContract,
      subcontracts: [],
    },
  };
  mocks.permissions = { isLoading: false, currentData: { canManage } };
}

beforeEach(() => {
  mocks.replace.mockReset();
  mocks.push.mockReset();
  mocks.update.mockReset();
  mocks.update.mockResolvedValue({ data: {} });
});
afterEach(cleanup);

function setup() {
  const user = userEvent.setup({ delay: null });
  render(<EditContractPage companyId="company-1" contractId="contract-1" />);
  return user;
}

async function next(user: ReturnType<typeof userEvent.setup>, to: string) {
  await user.click(screen.getByRole("button", { name: /^Next:/ }));
  // The step list marks the step now open.
  await vi.waitFor(() =>
    expect(
      screen
        .getByRole("list", { name: "Steps" })
        .querySelector('[aria-current="step"]')?.textContent,
    ).toContain(to),
  );
}

describe("EditContractPage", () => {
  it("tells someone who can't manage the contract why there's nothing to edit", () => {
    loaded(contract(), false);
    setup();
    expect(
      screen.getByText(
        /Only a Company Administrator of the company that created/,
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("doesn't edit an archived contract", () => {
    loaded(contract({ deletedAt: "2026-06-01T00:00:00.000Z" }));
    setup();
    expect(screen.getByText(/This contract is archived/)).toBeTruthy();
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("says when the contract isn't found", () => {
    mocks.detail = {
      isLoading: false,
      error: { status: 404, data: {} },
      currentData: undefined,
    };
    mocks.permissions = { isLoading: false, currentData: undefined };
    setup();
    expect(screen.getByText(/Contract was not found/)).toBeTruthy();
  });

  it("opens filled in, with only the page title above the card", () => {
    loaded(contract());
    setup();

    expect(
      screen.getByRole("heading", { level: 1, name: "Edit contract" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "CTR-001 · Pipeline maintenance",
      }),
    ).toBeTruthy();
    const reference = screen.getByLabelText(
      /Reference number/,
    ) as HTMLInputElement;
    expect(reference.value).toBe("CTR-001");
    expect(reference.readOnly).toBe(true);
    expect(
      (screen.getByLabelText(/Contract title/) as HTMLInputElement).value,
    ).toBe("Pipeline maintenance");
  });

  it("fixes the value and currency of an active contract, and saves only what may change", async () => {
    loaded(contract({ status: EContractStatus.ACTIVE }));
    const user = setup();

    const title = screen.getByLabelText(/Contract title/);
    await user.clear(title);
    await user.type(title, "Pipeline maintenance (phase 2)");
    // Basics, then commercial terms: no parties or parent contract step.
    await next(user, "Commercial terms");
    expect(screen.queryByLabelText(/party type/i)).toBeNull();
    expect(screen.queryByLabelText(/Parent contract/)).toBeNull();

    const value = screen.getByLabelText(
      /Original contract value/,
    ) as HTMLInputElement;
    expect(value.value).toBe("1,500,000.50");
    expect(value.readOnly).toBe(true);
    const currency = screen.getByLabelText(/Currency/) as HTMLInputElement;
    expect(currency.tagName).toBe("INPUT");
    expect(currency.readOnly).toBe(true);
    expect(currency.value).toBe("NGN");
    await next(user, "Dates");

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    const { contractId, body } = mocks.update.mock.lastCall![0];
    expect(contractId).toBe("contract-1");
    expect(body.title).toBe("Pipeline maintenance (phase 2)");
    expect(body).not.toHaveProperty("originalValueMinor");
    expect(body).not.toHaveProperty("currencyCode");
    expect(body).not.toHaveProperty("referenceNumber");
    expect(body).not.toHaveProperty("parentContractId");
    expect(mocks.replace).toHaveBeenCalledWith(
      "/dashboards/contracts/contract-1",
    );
  });

  it("sends the value and currency while the contract is still a draft", async () => {
    loaded(contract());
    const user = setup();
    await next(user, "Commercial terms");
    expect(
      (screen.getByLabelText(/Original contract value/) as HTMLInputElement)
        .readOnly,
    ).toBe(false);
    await next(user, "Dates");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update.mock.lastCall![0].body).toMatchObject({
      originalValueMinor: "150000050",
      currencyCode: ECurrencyCode.NGN,
    });
  });

  it("shows a subcontract's main contract as read-only context, never a choice", async () => {
    loaded(contract({ parentContractId: "parent-1" }), true, {
      id: "parent-1",
      referenceNumber: "MAIN-001",
      title: "Main works",
      status: EContractStatus.ACTIVE,
    });
    const user = setup();

    const steps = screen.getByRole("list", { name: "Steps" });
    expect(steps.textContent).not.toContain("Parent contract");
    expect(screen.getByText(/Subcontract of/).textContent).toContain(
      "MAIN-001 · Main works",
    );
    expect(
      screen.queryByRole("combobox", { name: /Parent contract/ }),
    ).toBeNull();

    await next(user, "Commercial terms");
    await next(user, "Dates");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    // Saving other fields leaves the parent alone.
    expect(mocks.update.mock.lastCall![0].body).not.toHaveProperty(
      "parentContractId",
    );
  });

  it("goes back to the contract on Cancel when nothing changed", async () => {
    loaded(contract());
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.push).toHaveBeenCalledWith("/dashboards/contracts/contract-1");
  });
});
