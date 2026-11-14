import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EContractSortField,
  EContractStatus,
  EContractType,
  ECurrencyCode,
  EPartyType,
  ESortOrder,
} from "@contractflow/contracts-schema";
import type { ContractListItem } from "@/services/contractApi";
import {
  contractSortOptions,
  useContractsList,
} from "../_hooks/use-contracts-list";
import { ContractsList } from "./contracts-screens";

const list = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));

vi.mock("../_hooks/use-contracts-list", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../_hooks/use-contracts-list")>()),
  useContractsList: vi.fn(() => list.state),
}));
vi.mock("./contract-lifecycle-management", () => ({
  ContractLifecycleManagement: () => null,
}));
vi.mock("./create-contract-form", () => ({
  CreateContractForm: ({ canCreate }: { canCreate: boolean }) =>
    canCreate ? <section>CREATE CONTRACT</section> : null,
}));
vi.mock("@/services/contractApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/contractApi")>()),
  useRestoreContractMutation: () => [vi.fn(), { isLoading: false }],
}));

function contract(
  overrides: Partial<ContractListItem> = {},
): ContractListItem {
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
    counterparties: [
      { companyName: "Bravo Energy Ltd", partyType: EPartyType.CLIENT },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as unknown as ContractListItem;
}

function page(data: ContractListItem[], totalItems = data.length) {
  return {
    data,
    meta: {
      totalItems,
      itemCount: data.length,
      itemsPerPage: 20,
      totalPages: Math.ceil(totalItems / 20),
      currentPage: 1,
    },
  };
}

function setState(state: Record<string, unknown>) {
  list.state = {
    searchInput: "",
    setSearchInput: vi.fn(),
    status: "",
    setStatus: vi.fn(),
    includeDeleted: false,
    setIncludeDeleted: vi.fn(),
    sort: "newest",
    setSort: vi.fn(),
    page: 1,
    setPage: vi.fn(),
    limit: 20,
    setLimit: vi.fn(),
    submitSearch: vi.fn(),
    search: "",
    hasFilters: false,
    clearFilters: vi.fn(),
    currentData: page([]),
    error: undefined,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(),
    ...state,
  };
}

function render(canViewArchived = true) {
  return renderToStaticMarkup(
    <ContractsList
      companyId="company-1"
      canViewArchived={canViewArchived}
      canCreateContracts={canViewArchived}
    />,
  );
}

describe("ContractsList", () => {
  beforeEach(() => setState({}));

  it("puts the page heading first, then the create action, then the register", () => {
    const markup = render();
    const heading = markup.indexOf("<h1");
    expect(heading).toBeGreaterThanOrEqual(0);
    expect(heading).toBeLessThan(markup.indexOf("CREATE CONTRACT"));
    expect(markup.indexOf("CREATE CONTRACT")).toBeLessThan(
      markup.indexOf(">Contract register</h2>"),
    );
  });

  it("links each contract's title to its detail page and shows its key facts", () => {
    setState({ currentData: page([contract()]) });
    const markup = render();

    // Both the narrow-screen cards and the table link the title.
    expect(
      markup.match(
        /<a[^>]*href="\/dashboards\/contracts\/c-1"[^>]*>Pipeline maintenance<\/a>/g,
      ),
    ).toHaveLength(2);
    expect(markup).toContain("CTR-001");
    expect(markup).toContain("Maintenance");
    expect(markup).toContain(">Active</span>");
    // 260,000,050 kobo, never shown as raw minor units.
    expect(markup).toMatch(/2[,.\s ]600[,.\s ]000[.,]50/);
    expect(markup).not.toContain("260000050");
    expect(markup).toMatch(/Feb 1, 2026|1 Feb 2026/);
    expect(markup).toMatch(/Dec 31, 2026|31 Dec 2026/);
    expect(markup).toContain(">Value</th>");
    expect(markup).toContain(">Start date</th>");
  });

  it("names the other parties to each contract, on cards and in the table", () => {
    setState({
      currentData: page([
        contract({
          counterparties: [
            { companyName: "Bravo Energy Ltd", partyType: EPartyType.CLIENT },
            { companyName: "Delta Supply", partyType: EPartyType.VENDOR },
          ],
        }),
        contract({ id: "c-2", counterparties: [] }),
      ]),
    });
    const markup = render();

    expect(markup).toContain(">Counterparty</th>");
    expect(markup).toContain(">Counterparty</dt>");
    expect(markup.match(/Bravo Energy Ltd/g)).toHaveLength(2);
    expect(markup).toContain("(Client)");
    expect(markup).toContain("Delta Supply");
    expect(markup).toContain("(Vendor)");
    // A contract no other company has joined yet says so.
    expect(markup.match(/>None yet</g)).toHaveLength(2);
  });

  it("shows the revised end date when there is one", () => {
    setState({
      currentData: page([contract({ revisedEndDate: "2027-03-31" })]),
    });
    expect(render()).toMatch(/Mar 31, 2027|31 Mar 2027/);
  });

  it("shows an archived contract as archived, opening read-only, with its restore action", () => {
    setState({
      includeDeleted: true,
      hasFilters: true,
      currentData: page([contract({ deletedAt: "2026-06-01T00:00:00.000Z" })]),
    });
    const markup = render();

    // It opens as read-only history; the API decides who may read it.
    expect(markup).toContain('href="/dashboards/contracts/c-1"');
    expect(markup).toContain(">Archived</span>");
    // The API lists no parties for archived contracts; don't claim "none".
    expect(markup).toContain(">Not shown<");
    expect(markup).not.toContain(">None yet<");
    expect(markup).toContain(">Actions</th>");
    expect(markup).toContain("Restore");
  });

  it("offers archived contracts only to company administrators", () => {
    expect(render(true)).toContain("Show archived contracts only");
    expect(render(false)).not.toContain("Show archived contracts only");
  });

  it("tells a company with no contracts that it has none yet", () => {
    const markup = render();

    expect(markup).toContain("No contracts yet.");
    expect(markup).not.toContain("No contracts match");
    expect(markup).not.toContain(">Clear filters<");
    expect(markup).not.toContain("Rows per page");
  });

  it("describes the list for its reader: oversight for administrators, own roles for members", () => {
    const admin = render(true);
    expect(admin).toContain("Contracts your company is a party to.");

    const member = render(false);
    expect(member).toContain("Contracts you hold a role on.");
    expect(member).not.toContain("Contracts your company is a party to.");
    expect(member).toContain(
      "No contracts yet. Contracts appear here once a Company Administrator or workspace administrator gives you a role on them.",
    );
  });

  it("tells a filtered search that nothing matches and offers to clear it", () => {
    setState({ hasFilters: true, search: "zzz", searchInput: "zzz" });
    const markup = render();

    expect(markup).toContain("No contracts match your search or filters.");
    expect(markup).not.toContain("No contracts yet.");
    expect(markup.match(/>Clear filters</g)).toHaveLength(2);
  });

  it("shows loading, then errors with a retry, never an empty state", () => {
    setState({ currentData: undefined, isLoading: true });
    const loading = render();
    expect(loading).toContain("Loading contracts…");
    expect(loading).not.toContain("No contracts");

    setState({
      currentData: undefined,
      error: { status: 500, data: { message: "Server unavailable." } },
    });
    const failed = render();
    // Server-side messages are never shown; the list's own message is.
    expect(failed).toContain("Unable to load contracts.");
    expect(failed).not.toContain("Server unavailable.");
    expect(failed).toContain(">Retry<");
    expect(failed).not.toContain("No contracts");
  });

  it("uses the server's pagination totals", () => {
    setState({ currentData: page([contract()], 45) });
    expect(render()).toMatch(/of 45/);
  });

  it("labels search as a search region with live, button-free filtering", () => {
    const markup = render();

    expect(markup).toContain('role="search"');
    expect(markup).toMatch(
      /<label[^>]*for="contract-search"[^>]*>Search contracts</,
    );
    expect(markup).toContain('type="search"');
    expect(markup).not.toMatch(/<button[^>]*type="submit"[^>]*>Search</);
  });
});

describe("contract sort options", () => {
  it("sort only by fields the API supports, in both directions where useful", () => {
    const supported = new Set<string>(Object.values(EContractSortField));
    for (const option of contractSortOptions) {
      expect(supported.has(option.sortBy), option.value).toBe(true);
    }
    const directions = (field: EContractSortField) =>
      contractSortOptions
        .filter((option) => option.sortBy === field)
        .map((option) => option.sortOrder)
        .sort();
    expect(directions(EContractSortField.START_DATE)).toEqual([
      ESortOrder.ASC,
      ESortOrder.DESC,
    ]);
    expect(directions(EContractSortField.END_DATE)).toEqual([
      ESortOrder.ASC,
      ESortOrder.DESC,
    ]);
    expect(new Set(contractSortOptions.map((o) => o.value)).size).toBe(
      contractSortOptions.length,
    );
  });
});

describe("useContractsList", () => {
  it("is the hook this screen uses", () => {
    // Guards the mock above from silently testing a different hook.
    expect(vi.isMockFunction(useContractsList)).toBe(true);
  });
});
