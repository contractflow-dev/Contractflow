import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EContractStatus,
  EContractType,
  ECurrencyCode,
  EPartyType,
} from "@contractflow/contracts-schema";
import type { ContractDetail as ContractDetailResponse } from "@/services/contractApi";
import { headingProblems } from "@/components/page-header/heading-outline";
import { useContractDetails } from "../_hooks/use-contract-details";
import { useContractsList } from "../_hooks/use-contracts-list";
import { ContractDetail, ContractsList } from "./contracts-screens";
import type { ContractSection } from "../contract-sections";

function renderSection(section: ContractSection) {
  return renderToStaticMarkup(
    <ContractDetail
      companyId="company-1"
      contractId="contract-1"
      section={section}
    />,
  );
}

vi.mock("../_hooks/use-contract-details", () => ({
  useContractDetails: vi.fn(),
}));

// The detail page reads activity deep-link targets from the URL (App Router).
const navigation = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.params,
}));

const sectionAccess = vi.hoisted(() => ({
  value: { roles: true, sites: true, signatories: true } as Record<
    "roles" | "sites" | "signatories",
    boolean | undefined
  >,
}));

vi.mock("../_hooks/use-contract-section-access", () => ({
  useContractSectionAccess: () => sectionAccess.value,
}));

vi.mock("./contract-role-assignment-management", () => ({
  ContractRoleAssignmentManagement: () => <div>Contract role assignments</div>,
}));

vi.mock("./contract-lifecycle-management", () => ({
  ContractLifecycleManagement: () => <div>Contract lifecycle management</div>,
}));

vi.mock("./create-contract-form", () => ({
  CreateContractForm: () => <div>Create contract</div>,
}));

vi.mock("../_hooks/use-contracts-list", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../_hooks/use-contracts-list")>()),
  useContractsList: vi.fn(),
}));

vi.mock("./contract-signatory-management", () => ({
  ContractSignatoryManagement: () => <div>Contract signatory management</div>,
}));

vi.mock("./contract-site-management", () => ({
  ContractSiteManagement: () => <div>Contract site management</div>,
}));

vi.mock("@/hooks/use-user-time-zone", () => ({
  useUserTimeZone: () => "UTC",
}));

// The timeline has its own tests; here only its placement matters.
vi.mock("./contract-workspace-screens", () => ({
  ContractWorkspacesCard: () => <div>Your workspaces</div>,
}));

vi.mock("./contract-activity", () => ({
  ContractActivity: ({ contractId }: { contractId: string }) => (
    <section>Contract activity for {contractId}</section>
  ),
}));

const contractDetail: ContractDetailResponse = {
  contract: {
    id: "contract-1",
    referenceNumber: "CTR-001",
    title: "Test contract",
    description: "",
    contractType: Object.values(EContractType)[0],
    status: Object.values(EContractStatus)[0],
    parentContractId: null,
    originalValueMinor: 1000,
    currentValueMinor: 1000,
    currencyCode: ECurrencyCode.USD,
    retentionRateBps: 0,
    advancePaymentRateBps: 0,
    paymentTermsDays: 30,
    liquidatedDamagesPerDayMinor: 0,
    awardDate: "2026-01-01",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    revisedEndDate: "",
    actualCompletionDate: "",
    defectsLiabilityDays: 0,
    timezone: "UTC",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  membership: {
    id: "membership-1",
    companyId: "company-1",
    partyType: Object.values(EPartyType)[0],
    signedAt: null,
  },
};

describe("ContractDetail query states", () => {
  const useContractDetailsMock = vi.mocked(useContractDetails);

  beforeEach(() => {
    navigation.params = new URLSearchParams();
    useContractDetailsMock.mockReturnValue({
      detail: contractDetail,
      error: undefined,
      isLoading: false,
      refetch: vi.fn(),
      parties: undefined,
      partiesError: { status: 500, data: {} },
      partiesLoading: false,
      history: undefined,
      historyError: { status: 500, data: {} },
      historyLoading: false,
      historyFetching: false,
      setHistoryPage: vi.fn(),
      setHistoryPageSize: vi.fn(),
    });
  });

  it("shows independent errors for failed parties and history requests", () => {
    const parties = renderSection("parties");
    const history = renderSection("history");

    expect(parties).toContain("Unable to load contract parties.");
    expect(parties).not.toContain("No party details are available.");
    expect(history).toContain("Unable to load status history.");
    expect(history).not.toContain("No status changes have been recorded.");
    // The activity timeline is a separate request and still renders, after
    // the status history.
    expect(history).toContain("Contract activity for contract-1");
    expect(history.indexOf("Status history")).toBeLessThan(
      history.indexOf("Contract activity for contract-1"),
    );
    expect(parties).not.toContain("Contract activity for");
    // Each section shows only its own content.
    expect(parties).not.toContain("Unable to load status history.");
    expect(history).not.toContain("Unable to load contract parties.");
  });

  it("shows loading states for parties and history independently", () => {
    useContractDetailsMock.mockReturnValue({
      detail: contractDetail,
      error: undefined,
      isLoading: false,
      refetch: vi.fn(),
      parties: undefined,
      partiesError: undefined,
      partiesLoading: true,
      history: undefined,
      historyError: undefined,
      historyLoading: true,
      historyFetching: true,
      setHistoryPage: vi.fn(),
      setHistoryPageSize: vi.fn(),
    });

    const parties = renderSection("parties");
    const history = renderSection("history");

    expect(parties).toContain("Loading parties…");
    expect(parties).not.toContain("No party details are available.");
    expect(history).toContain("Loading status history…");
    expect(history).not.toContain("No status changes have been recorded.");
  });

  it("formats the contract value in its currency and dates as calendar days", () => {
    useContractDetailsMock.mockReturnValue({
      detail: {
        ...contractDetail,
        contract: {
          ...contractDetail.contract,
          originalValueMinor: "250000000",
          currentValueMinor: "260000050",
          currencyCode: ECurrencyCode.EUR,
          endDate: "2026-12-31",
          status: EContractStatus.SUSPENDED,
        },
      },
      error: undefined,
      isLoading: false,
      refetch: vi.fn(),
      parties: [],
      partiesError: undefined,
      partiesLoading: false,
      history: {
        data: [
          {
            id: "history-1",
            fromStatus: "draft",
            toStatus: "active",
            reason: "Mobilised",
            changedAt: "2026-02-01T09:30:00.000Z",
          },
        ],
        meta: {
          totalItems: 1,
          itemCount: 1,
          itemsPerPage: 10,
          totalPages: 1,
          currentPage: 1,
        },
      },
      historyError: undefined,
      historyLoading: false,
      historyFetching: false,
      setHistoryPage: vi.fn(),
      setHistoryPageSize: vi.fn(),
    } as unknown as ReturnType<typeof useContractDetails>);

    const markup = renderSection("overview");
    const history = renderSection("history");

    // 250,000,000 euro cents, never shown in NGN or as raw minor units.
    expect(markup).toMatch(/2[,.\s\u00a0]500[,.\s\u00a0]000/);
    expect(markup).not.toContain("250000000");
    expect(markup).toContain("€");
    expect(markup).toMatch(/Dec 31, 2026|31 Dec 2026/);
    // The header's status shows on every section.
    expect(markup).toContain('data-status="suspended"');
    expect(markup).toContain(">Suspended</span>");
    expect(history).toContain(">Draft</span>");
    expect(history).toContain(">Active</span>");
    expect(history).not.toContain(">draft<");
  });
});

describe("contract screen headings", () => {
  it("gives the contract detail one <h1>, the contract title, with nested sections", () => {
    vi.mocked(useContractDetails).mockReturnValue({
      detail: contractDetail,
      error: undefined,
      isLoading: false,
      refetch: vi.fn(),
      parties: {
        data: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: 20,
          totalPages: 0,
          currentPage: 1,
        },
      },
      partiesError: undefined,
      partiesLoading: false,
      history: {
        data: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: 20,
          totalPages: 0,
          currentPage: 1,
        },
      },
      historyError: undefined,
      historyLoading: false,
      historyFetching: false,
      setHistoryPage: vi.fn(),
      setHistoryPageSize: vi.fn(),
    } as unknown as ReturnType<typeof useContractDetails>);

    for (const section of [
      "overview",
      "parties",
      "roles",
      "sites",
      "signatories",
      "history",
    ] as const) {
      const markup = renderSection(section);
      expect(markup, section).toMatch(
        new RegExp(
          String.raw`<h1[^>]*>\s*${contractDetail.contract.title}\s*</h1>`,
        ),
      );
      expect(headingProblems(markup), section).toEqual([]);
    }
  });

  it("gives the contract list one <h1>, Contracts, before its sections", () => {
    vi.mocked(useContractsList).mockReturnValue({
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
      hasFilters: false,
      clearFilters: vi.fn(),
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
      error: undefined,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useContractsList>);

    const markup = renderToStaticMarkup(
      <ContractsList companyId="company-1" canViewArchived canCreateContracts />,
    );

    expect(markup).toMatch(/<h1[^>]*>Contracts<\/h1>/);
    expect(headingProblems(markup)).toEqual([]);

    // "Show archived contracts only" is the shared Checkbox, labelled by a
    // <label for> on its input, and unchecked by default.
    expect(markup).toMatch(/role="checkbox"[^>]*aria-checked="false"/);
    const inputId = /<input id="([^"]+)"[^>]*type="checkbox"/.exec(markup)?.[1];
    expect(markup).toContain(
      `for="${inputId}">Show archived contracts only</label>`,
    );
    expect(markup).not.toContain("accent-primary");
  });
});
