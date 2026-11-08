import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EContractStatus,
  EContractType,
  ECurrencyCode,
  EPartyType,
} from "@contractflow/contracts-schema";
import type { ContractDetail as ContractDetailResponse } from "@/services/contractApi";
import { useContractDetails } from "../_hooks/use-contract-details";
import { ContractDetail } from "./contracts-screens";

vi.mock("../_hooks/use-contract-details", () => ({
  useContractDetails: vi.fn(),
}));

vi.mock("./contract-role-assignment-management", () => ({
  ContractRoleAssignmentManagement: () => <div>Contract role assignments</div>,
}));

vi.mock("./contract-lifecycle-management", () => ({
  ContractLifecycleManagement: () => <div>Contract lifecycle management</div>,
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
    const markup = renderToStaticMarkup(
      <ContractDetail companyId="company-1" contractId="contract-1" />,
    );

    expect(markup).toContain("Unable to load contract parties.");
    expect(markup).toContain("Unable to load status history.");
    expect(markup).not.toContain("No party details are available.");
    expect(markup).not.toContain("No status changes have been recorded.");
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

    const markup = renderToStaticMarkup(
      <ContractDetail companyId="company-1" contractId="contract-1" />,
    );

    expect(markup).toContain("Loading parties…");
    expect(markup).toContain("Loading status history…");
    expect(markup).not.toContain("No party details are available.");
    expect(markup).not.toContain("No status changes have been recorded.");
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

    const markup = renderToStaticMarkup(
      <ContractDetail companyId="company-1" contractId="contract-1" />,
    );

    // 250,000,000 euro cents, never shown in NGN or as raw minor units.
    expect(markup).toMatch(/2[,.\s\u00a0]500[,.\s\u00a0]000/);
    expect(markup).not.toContain("250000000");
    expect(markup).toContain("€");
    expect(markup).toMatch(/Dec 31, 2026|31 Dec 2026/);
    expect(markup).toContain('data-status="suspended"');
    expect(markup).toContain(">Suspended</span>");
    expect(markup).toContain(">Draft</span>");
    expect(markup).toContain(">Active</span>");
    expect(markup).not.toContain(">draft<");
  });
});
