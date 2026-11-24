// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  EContractSortField,
  EContractStatus,
  EContractType,
  ECurrencyCode,
  ESortOrder,
} from "@contractflow/contracts-schema";
import type { ContractListItem } from "@/services/contractApi";
import { ContractsList } from "./contracts-screens";

vi.setConfig({ testTimeout: 20_000 });
// jsdom has no PointerEvent, which Base UI's checkbox creates on click.
window.PointerEvent ??= MouseEvent as unknown as typeof PointerEvent;

const mocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  counts: {} as Record<string, number | undefined>,
}));

vi.mock("../_hooks/use-contracts-list", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../_hooks/use-contracts-list")>()),
  useContractsList: vi.fn(() => mocks.state),
}));
vi.mock("../_hooks/use-contract-status-counts", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../_hooks/use-contract-status-counts")
  >()),
  useContractStatusCounts: vi.fn(() => mocks.counts),
}));
vi.mock("./contract-lifecycle-management", () => ({
  ContractLifecycleManagement: () => null,
}));
vi.mock("@/services/contractApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/contractApi")>()),
  useRestoreContractMutation: () => [vi.fn(), { isLoading: false }],
}));

function contract(overrides: Partial<ContractListItem> = {}): ContractListItem {
  return {
    id: "c-1",
    referenceNumber: "CTR-001",
    title: "Pipeline maintenance",
    description: "",
    contractType: EContractType.MAINTENANCE,
    status: EContractStatus.ACTIVE,
    parentContractId: null,
    originalValueMinor: "250000000",
    currentValueMinor: "260000050",
    currencyCode: ECurrencyCode.NGN,
    awardDate: "2026-01-01",
    startDate: "2026-02-01",
    endDate: "2026-12-31",
    revisedEndDate: null,
    deletedAt: null,
    counterparties: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as unknown as ContractListItem;
}

function setState(state: Record<string, unknown> = {}) {
  mocks.state = {
    searchInput: "",
    setSearchInput: vi.fn(),
    search: "",
    status: "",
    setStatus: vi.fn(),
    includeDeleted: false,
    setIncludeDeleted: vi.fn(),
    sort: "newest",
    setSort: vi.fn(),
    sortBy: EContractSortField.CREATED_AT,
    sortOrder: ESortOrder.DESC,
    toggleSort: vi.fn(),
    setPage: vi.fn(),
    setLimit: vi.fn(),
    submitSearch: vi.fn((event: Event) => event.preventDefault()),
    clearSearch: vi.fn(),
    hasFilters: false,
    clearFilters: vi.fn(),
    currentData: {
      data: [contract()],
      meta: {
        totalItems: 1,
        itemCount: 1,
        itemsPerPage: 20,
        totalPages: 1,
        currentPage: 1,
      },
    },
    error: undefined,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(),
    ...state,
  };
}

function setup(canManage = true) {
  const user = userEvent.setup({ delay: null });
  render(
    <ContractsList
      companyId="company-1"
      canViewArchived={canManage}
      canCreateContracts={canManage}
    />,
  );
  return user;
}

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Filters/ }));
  return (await screen.findByLabelText("Status")) as HTMLSelectElement;
}
const table = () => screen.getByRole("table", { name: "Contracts" });

beforeEach(() => {
  setState();
  mocks.counts = {};
});
afterEach(cleanup);

describe("contract register filters", () => {
  it("offers the contract statuses in the dropdown, with the applied one selected", async () => {
    setState({ status: EContractStatus.DRAFT });
    const user = setup();

    const status = await openFilters(user);
    expect([...status.options].map((option) => option.textContent)).toEqual([
      "All contracts",
      "Active",
      "Draft",
      "Suspended",
      "Completed",
    ]);
    expect(status.value).toBe(EContractStatus.DRAFT);
    expect(
      screen.getByRole("button", { name: /^Filters\W*1 active/ }),
    ).toBeTruthy();
  });

  it("shows the API's counts, and none where the API hasn't answered", async () => {
    mocks.counts = { "": 12, [EContractStatus.ACTIVE]: 7 };
    const user = setup();

    const status = await openFilters(user);
    const labels = [...status.options].map((option) => option.textContent);
    expect(labels).toContain("All contracts (12)");
    expect(labels).toContain("Active (7)");
    // No count is made up for statuses the API hasn't counted yet.
    expect(labels).toContain("Draft");
  });

  it("asks the list for the chosen status as soon as it is picked", async () => {
    const user = setup();

    await user.selectOptions(await openFilters(user), EContractStatus.ACTIVE);
    expect(mocks.state.setStatus).toHaveBeenCalledWith(EContractStatus.ACTIVE);
  });
});

describe("contract register toolbar", () => {
  it("labels the search and clears it with its own button", async () => {
    setState({ searchInput: "jetty", search: "jetty" });
    const user = setup();

    expect(
      screen.getByRole("searchbox", { name: "Search contracts" }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(mocks.state.clearSearch).toHaveBeenCalledOnce();
  });

  it("shows no clear button for an empty search", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("keeps the archived filter in the dropdown, labelled and working", async () => {
    const user = setup();

    await openFilters(user);
    const checkbox = await screen.findByRole("checkbox", {
      name: "Show archived contracts only",
    });
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    await user.click(checkbox);
    expect(mocks.state.setIncludeDeleted).toHaveBeenCalledWith(true);
  });

  it("lists active filters in the dropdown, each removable, and leaves search alone", async () => {
    setState({
      searchInput: "jetty",
      search: "jetty",
      includeDeleted: true,
      hasFilters: true,
    });
    const user = setup();

    await openFilters(user);
    await user.click(
      screen.getByRole("button", {
        name: "Remove filter: Show archived contracts only",
      }),
    );
    expect(mocks.state.setIncludeDeleted).toHaveBeenCalledWith(false);
    expect(mocks.state.clearSearch).not.toHaveBeenCalled();
  });
});

describe("contract register table", () => {
  it("sorts by a column from its header, announcing the current order", async () => {
    setState({
      sortBy: EContractSortField.START_DATE,
      sortOrder: ESortOrder.ASC,
    });
    const user = setup();

    const startDate = within(table()).getByRole("columnheader", {
      name: /Start date/,
    });
    expect(startDate.getAttribute("aria-sort")).toBe("ascending");
    expect(
      within(table())
        .getByRole("columnheader", { name: /End date/ })
        .getAttribute("aria-sort"),
    ).toBe("none");
    // Counterparty and Value can't be sorted by the API, so they aren't.
    expect(
      within(
        within(table()).getByRole("columnheader", { name: "Value" }),
      ).queryByRole("button"),
    ).toBeNull();

    await user.click(within(startDate).getByRole("button"));
    expect(mocks.state.toggleSort).toHaveBeenCalledWith(
      EContractSortField.START_DATE,
    );
    await user.click(within(table()).getByRole("button", { name: "Status" }));
    expect(mocks.state.toggleSort).toHaveBeenLastCalledWith(
      EContractSortField.STATUS,
    );
  });

  it("right-aligns money in tabular figures", () => {
    setup();
    const value = within(table()).getAllByRole("cell")[2];
    expect(value.className).toContain("text-end");
    expect(value.className).toContain("tabular-nums");
  });

  it("opens a row's actions from its own menu, with links to the contract", async () => {
    const user = setup();

    const [, desktopMenu] = screen.getAllByRole("button", {
      name: "Actions for CTR-001 · Pipeline maintenance",
    });
    await user.click(desktopMenu);
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "View contract",
      "View parties",
      "View status history",
    ]);
    expect(items.map((item) => item.getAttribute("href"))).toEqual([
      "/dashboards/contracts/c-1",
      "/dashboards/contracts/c-1/parties",
      "/dashboards/contracts/c-1/history",
    ]);
  });
});

describe("contract register permissions and states", () => {
  it("offers New contract and the archived filter only to company administrators", async () => {
    const member = setup(false);
    expect(screen.queryByRole("link", { name: /New contract/ })).toBeNull();
    await openFilters(member);
    expect(
      screen.queryByRole("checkbox", { name: "Show archived contracts only" }),
    ).toBeNull();
    cleanup();

    setup(true);
    expect(
      screen.getByRole("link", { name: /New contract/ }).getAttribute("href"),
    ).toBe("/dashboards/contracts/new");
  });

  it("offers an administrator New contract from the empty register too", () => {
    setState({
      currentData: {
        data: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: 20,
          totalPages: 0,
          currentPage: 1,
        },
      },
    });
    setup();
    expect(screen.getByText("No contracts yet.")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /New contract/ })).toHaveLength(
      2,
    );
  });

  it("shows skeleton rows while loading, announced once", () => {
    setState({ currentData: undefined, isLoading: true });
    setup();
    expect(
      screen.getByRole("status", { name: "Loading contracts…" }),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("retries a failed load", async () => {
    setState({
      currentData: undefined,
      error: { status: 500, data: { message: "Server unavailable." } },
    });
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.state.refetch).toHaveBeenCalledOnce();
    expect(screen.queryByText(/No contracts/)).toBeNull();
  });
});
