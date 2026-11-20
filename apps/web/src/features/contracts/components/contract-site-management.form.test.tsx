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
  EContractSiteStatus,
  EContractStatus,
  EContractType,
} from "@contractflow/contracts-schema";
import type { Contract } from "@/services/contractApi";
import { ContractSiteManagement } from "./contract-site-management";

// Typing re-filters ~250 countries in jsdom; allow for a busy parallel run.
vi.setConfig({ testTimeout: 20_000 });

const mocks = vi.hoisted(() => ({ updateSite: vi.fn() }));

vi.mock("@/services/contractApi", () => ({
  useGetContractLifecyclePermissionsQuery: () => ({
    data: { canManage: true },
  }),
  useGetManagedContractSitesQuery: () => ({
    currentData: [
      {
        id: "site-1",
        contractId: "contract-1",
        name: "North yard",
        siteCode: "NY-01",
        addressLine1: "1 Quay Road",
        city: "Port Harcourt",
        stateRegion: "Rivers State",
        countryCode: "NG",
        latitudeE6: 4_815_554,
        longitudeE6: 7_049_844,
        status: EContractSiteStatus.ACTIVE,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    isLoading: false,
    error: undefined,
    refetch: vi.fn(),
  }),
  useCreateContractSiteMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateContractSiteMutation: () => [mocks.updateSite, { isLoading: false }],
}));
vi.mock("@/lib/notify", () => ({ notifySuccess: vi.fn() }));

const contract = {
  id: "contract-1",
  referenceNumber: "CTR-001",
  title: "Bridge works",
  contractType: Object.values(EContractType)[0],
  status: EContractStatus.DRAFT,
} as Contract;

beforeEach(() => {
  mocks.updateSite.mockReset();
  mocks.updateSite.mockResolvedValue({ data: {} });
});
afterEach(cleanup);

describe("site form side sheet", () => {
  function setup() {
    const user = userEvent.setup({ delay: null });
    render(
      <ContractSiteManagement companyId="company-1" contract={contract} />,
    );
    return user;
  }

  it("adds a site in a side sheet, leaving the table where it is", async () => {
    const user = setup();
    expect(screen.queryByRole("dialog")).toBeNull();

    const add = screen.getByRole("button", { name: "Add site" });
    expect(add.getAttribute("aria-haspopup")).toBe("dialog");
    await user.click(add);

    const sheet = await screen.findByRole("dialog", { name: "Add a site" });
    expect(
      within(sheet).getByRole("form", { name: "Add a site" }),
    ).toBeTruthy();
    expect(within(sheet).getByLabelText(/Site name/)).toBeTruthy();
    // The table keeps its rows; nothing opened inside the card.
    const table = screen.getByRole("table", {
      name: "Contract sites",
      hidden: true,
    });
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(2);
  });

  it("edits a site in the sheet, filled in from the site", async () => {
    const user = setup();
    await user.click(
      screen.getByRole("button", { name: "Edit site North yard" }),
    );
    const sheet = await screen.findByRole("dialog", {
      name: "Edit North yard",
    });
    expect(
      (within(sheet).getByLabelText(/Site name/) as HTMLInputElement).value,
    ).toBe("North yard");
  });

  it("isn't closed by a click outside, so a half-filled form isn't lost", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Add site" }));
    const sheet = await screen.findByRole("dialog", { name: "Add a site" });
    await user.type(within(sheet).getByLabelText(/Site name/), "South yard");

    const overlay = document.querySelector<HTMLElement>(
      '[data-slot="sheet-overlay"]',
    )!;
    await user.click(overlay);
    expect(screen.getByRole("dialog", { name: "Add a site" })).toBeTruthy();
    expect((screen.getByLabelText(/Site name/) as HTMLInputElement).value).toBe(
      "South yard",
    );
  });

  it("closes with Escape or Cancel", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Add site" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Add site" }));
    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes once the site is saved", async () => {
    const user = setup();
    await user.click(
      screen.getByRole("button", { name: "Edit site North yard" }),
    );
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Save site" }));
    await waitFor(() => expect(mocks.updateSite).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("Contract site address", () => {
  it("edits a site's state and sends the canonical name with the ISO code", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <ContractSiteManagement companyId="company-1" contract={contract} />,
    );
    await user.click(
      screen.getByRole("button", { name: "Edit site North yard" }),
    );

    // A legacy "Rivers State" is shown as the listed state.
    const state = screen.getByRole("combobox", { name: /State/ });
    expect(state).toHaveProperty("value", "Rivers");

    await user.clear(state);
    await user.type(state, "bayel");
    await user.click(screen.getByRole("option", { name: "Bayelsa" }));
    await user.click(screen.getByRole("button", { name: "Save site" }));

    await waitFor(() => expect(mocks.updateSite).toHaveBeenCalledOnce());
    expect(mocks.updateSite.mock.calls[0][0].body).toMatchObject({
      countryCode: "NG",
      stateRegion: "Bayelsa",
      city: "Port Harcourt",
    });
  });

  it("clears the state when the country changes and requires a new one", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <ContractSiteManagement companyId="company-1" contract={contract} />,
    );
    await user.click(
      screen.getByRole("button", { name: "Edit site North yard" }),
    );

    const country = screen.getByRole("combobox", { name: /Country/ });
    await user.clear(country);
    await user.type(country, "united states");
    await user.click(screen.getByRole("option", { name: "United States" }));

    const state = screen.getByRole("combobox", { name: /State/ });
    expect(state).toHaveProperty("value", "");

    // Like the form's other fields, the browser's required check blocks it.
    const form = screen.getByRole("form", { name: "Edit site North yard" });
    const hidden = form.querySelector<HTMLInputElement>(
      'input[name="stateRegion"]',
    );
    expect(hidden?.validity.valueMissing).toBe(true);
    await user.click(screen.getByRole("button", { name: "Save site" }));
    expect(mocks.updateSite).not.toHaveBeenCalled();
  });
});
