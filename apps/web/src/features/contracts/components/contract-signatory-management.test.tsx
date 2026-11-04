import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ECompanyRole,
  EContractStatus,
  EContractType,
  ECurrencyCode,
  EPartyType,
} from "@contractflow/contracts-schema";
import type { Contract } from "@/services/contractApi";
import { ContractSignatoryManagement } from "./contract-signatory-management";

const mocks = vi.hoisted(() => ({
  getMembership: vi.fn(),
  getSignatory: vi.fn(),
  recordSignatory: vi.fn(),
}));

vi.mock("@/services/companiesApi", () => ({
  useGetCompanyMembershipQuery: mocks.getMembership,
}));

vi.mock("@/services/contractApi", () => ({
  useGetContractSignatoryQuery: mocks.getSignatory,
  useRecordContractSignatoryMutation: () => [
    mocks.recordSignatory,
    { isLoading: false, error: undefined },
  ],
}));

const contract: Contract = {
  id: "contract-1",
  referenceNumber: "CTR-001",
  title: "Bridge works",
  description: null,
  contractType: Object.values(EContractType)[0],
  status: EContractStatus.ACTIVE,
  parentContractId: null,
  originalValueMinor: 100,
  currentValueMinor: 100,
  currencyCode: ECurrencyCode.USD,
  retentionRateBps: 0,
  advancePaymentRateBps: null,
  paymentTermsDays: 30,
  liquidatedDamagesPerDayMinor: null,
  awardDate: "2026-01-01",
  startDate: "2026-01-02",
  endDate: "2026-12-31",
  revisedEndDate: null,
  actualCompletionDate: null,
  defectsLiabilityDays: 0,
  timezone: "UTC",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
};

function membership(companyRole: ECompanyRole) {
  return { data: { membership: { companyRole } } };
}

describe("ContractSignatoryManagement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSignatory.mockReturnValue({
      data: {
        id: "party-1",
        companyId: "company-1",
        partyType: EPartyType.CLIENT,
        signatoryFirstName: "Ada",
        signatoryLastName: "Lovelace",
        signatoryTitle: "Director",
        signedAt: "2026-01-15T00:00:00.000Z",
      },
      isLoading: false,
      error: undefined,
      refetch: vi.fn(),
    });
  });

  it("prefills the company's recorded signatory for a Company Administrator", () => {
    mocks.getMembership.mockReturnValue(
      membership(ECompanyRole.COMPANY_ADMIN),
    );

    const markup = renderToStaticMarkup(
      <ContractSignatoryManagement companyId="company-1" contract={contract} />,
    );

    expect(markup).toContain("Your company&#x27;s signatory");
    expect(markup).toContain('value="Ada"');
    expect(markup).toContain('value="2026-01-15"');
    expect(mocks.getSignatory).toHaveBeenCalledWith(
      { companyId: "company-1", contractId: "contract-1" },
      { skip: false },
    );
  });

  it("is hidden from members who are not Company Administrators", () => {
    mocks.getMembership.mockReturnValue(
      membership(ECompanyRole.CLIENT_PROJECT_MANAGER),
    );

    const markup = renderToStaticMarkup(
      <ContractSignatoryManagement companyId="company-1" contract={contract} />,
    );

    expect(markup).toBe("");
    expect(mocks.getSignatory).toHaveBeenCalledWith(expect.anything(), {
      skip: true,
    });
  });

  it("is hidden on archived contracts", () => {
    mocks.getMembership.mockReturnValue(
      membership(ECompanyRole.COMPANY_ADMIN),
    );

    const markup = renderToStaticMarkup(
      <ContractSignatoryManagement
        companyId="company-1"
        contract={{ ...contract, deletedAt: "2026-02-01T00:00:00.000Z" }}
      />,
    );

    expect(markup).toBe("");
  });

  it("offers a retry when the signatory cannot be loaded", () => {
    mocks.getMembership.mockReturnValue(
      membership(ECompanyRole.COMPANY_ADMIN),
    );
    mocks.getSignatory.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500, data: {} },
      refetch: vi.fn(),
    });

    const markup = renderToStaticMarkup(
      <ContractSignatoryManagement companyId="company-1" contract={contract} />,
    );

    expect(markup).toContain("Retry");
  });
});
