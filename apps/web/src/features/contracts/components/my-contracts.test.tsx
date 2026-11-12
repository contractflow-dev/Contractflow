import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EContractStatus,
  EContractType,
  ECurrencyCode,
  EPartyType,
  EContractorContractRole,
} from "@contractflow/contracts-schema";
import type { ContractListItem } from "@/services/contractApi";
import { useContractsList } from "../_hooks/use-contracts-list";
import { MyContracts } from "./my-contracts";

const list = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));

vi.mock("../_hooks/use-contracts-list", () => ({
  useContractsList: vi.fn(() => list.state),
}));
vi.mock("./contract-lifecycle-management", () => ({
  ContractLifecycleManagement: () => null,
}));
vi.mock("./create-contract-form", () => ({ CreateContractForm: () => null }));
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
    currentValueMinor: "250000000",
    currencyCode: ECurrencyCode.NGN,
    awardDate: "2026-01-01",
    startDate: "2026-02-01",
    endDate: "2026-12-31",
    revisedEndDate: null,
    deletedAt: null,
    counterparties: [{ companyName: "Bravo Energy", partyType: EPartyType.CLIENT }],
    myRoles: [
      {
        role: EContractorContractRole.FINANCE_OFFICER,
        workspace: "finance",
        isWorkspaceAdmin: true,
      },
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
      totalPages: Math.max(1, Math.ceil(totalItems / 20)),
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
    setPage: vi.fn(),
    setLimit: vi.fn(),
    submitSearch: vi.fn(),
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

const render = () =>
  renderToStaticMarkup(<MyContracts companyId="company-1" companyName="Acme Works" />);

describe("MyContracts", () => {
  beforeEach(() => setState({}));

  it("asks the server only for the user's own contracts in this company", () => {
    render();
    expect(vi.mocked(useContractsList)).toHaveBeenLastCalledWith("company-1", {
      canViewArchived: false,
      assignedToMe: true,
    });
  });

  it("shows each contract with the user's roles and a link to it", () => {
    setState({ currentData: page([contract()], 1) });
    const markup = render();

    expect(markup).toMatch(/<h1[^>]*>My Contracts<\/h1>/);
    expect(markup).toContain("View and manage the contracts assigned to you.");
    expect(markup).toMatch(
      /<a[^>]*href="\/dashboards\/contracts\/c-1"[^>]*>Pipeline maintenance<\/a>/,
    );
    expect(markup).toContain("Finance Officer · Finance · Workspace admin");
    expect(markup).toContain("Bravo Energy");
    expect(markup).toMatch(/2[,.\s ]500[,.\s ]000\.00/);
    expect(markup).toContain("You hold a role on 1 contract.");
  });

  it("leaves out a roles list when the server sends none", () => {
    setState({ currentData: page([contract({ myRoles: [] })], 1) });
    expect(render()).not.toContain('aria-label="Your roles"');
  });

  it("explains how access is granted when nothing is assigned, without a create action", () => {
    const markup = render();

    expect(markup).toContain("No contracts assigned to you yet");
    expect(markup).toContain("Company Administrators assign contract roles");
    expect(markup).toContain("role invitations arrive by email");
    expect(markup).toContain('href="/dashboards/contracts"');
    expect(markup).not.toMatch(/New contract|Create contract/);
    expect(markup).not.toContain("You hold a role on");
  });

  it("tells a filtered search that nothing matches and offers to clear it", () => {
    setState({ hasFilters: true });
    const markup = render();

    expect(markup).toContain("None of your contracts match your search or filters.");
    expect(markup).not.toContain("No contracts assigned to you yet");
    expect(markup.match(/>Clear filters</g)).toHaveLength(2);
  });

  it("shows loading, then an error with retry, never an empty state", () => {
    setState({ currentData: undefined, isLoading: true });
    const loading = render();
    expect(loading).toContain('aria-label="Loading your contracts"');
    expect(loading).not.toContain("No contracts assigned");

    setState({ currentData: undefined, error: { status: 500, data: {} } });
    const failed = render();
    expect(failed).toContain("Unable to load your contracts.");
    expect(failed).toContain(">Retry<");
    expect(failed).not.toContain("No contracts assigned");
  });

  it("labels the search and status controls", () => {
    const markup = render();
    expect(markup).toContain('role="search"');
    expect(markup).toMatch(/<label[^>]*for="my-contract-search"/);
    expect(markup).toMatch(/<label[^>]*for="my-contract-status"/);
  });
});
