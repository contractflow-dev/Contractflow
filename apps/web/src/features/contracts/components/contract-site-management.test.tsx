import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EContractSiteStatus,
  EContractStatus,
  EContractType,
} from "@contractflow/contracts-schema";
import type { Contract } from "@/services/contractApi";
import {
  ContractSiteManagement,
  fromMicroDegrees,
  toMicroDegrees,
} from "./contract-site-management";

const mocks = vi.hoisted(() => ({
  getPermissions: vi.fn(),
  getSites: vi.fn(),
}));

vi.mock("@/services/contractApi", () => ({
  useGetContractLifecyclePermissionsQuery: mocks.getPermissions,
  useGetManagedContractSitesQuery: mocks.getSites,
  useCreateContractSiteMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateContractSiteMutation: () => [vi.fn(), { isLoading: false }],
}));

const contract = {
  id: "contract-1",
  referenceNumber: "CTR-001",
  title: "Bridge works",
  contractType: Object.values(EContractType)[0],
  status: EContractStatus.DRAFT,
} as Contract;

describe("ContractSiteManagement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSites.mockReturnValue({
      currentData: [
        {
          id: "site-1",
          contractId: "contract-1",
          name: "North yard",
          siteCode: "NY-01",
          addressLine1: "1 Quay Road",
          city: "Lagos",
          stateRegion: "Lagos",
          countryCode: "NG",
          latitudeE6: 6_524_379,
          longitudeE6: -3_379_206,
          status: EContractSiteStatus.ACTIVE,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      isLoading: false,
      error: undefined,
      refetch: vi.fn(),
    });
  });

  it("lists sites with decimal-degree coordinates for contract managers", () => {
    mocks.getPermissions.mockReturnValue({ data: { canManage: true } });

    const markup = renderToStaticMarkup(
      <ContractSiteManagement companyId="company-1" contract={contract} />,
    );

    expect(markup).toContain("North yard");
    expect(markup).toContain("6.524379, -3.379206");
    expect(markup).toContain("Add site");
    expect(mocks.getSites).toHaveBeenCalledWith(
      { companyId: "company-1", contractId: "contract-1" },
      { skip: false },
    );
  });

  it("does not request or render sites without contract management access", () => {
    mocks.getPermissions.mockReturnValue({ data: { canManage: false } });

    const markup = renderToStaticMarkup(
      <ContractSiteManagement companyId="company-1" contract={contract} />,
    );

    expect(markup).toBe("");
    expect(mocks.getSites).toHaveBeenCalledWith(expect.anything(), {
      skip: true,
    });
  });

  it("shows an empty state when no sites exist", () => {
    mocks.getPermissions.mockReturnValue({ data: { canManage: true } });
    mocks.getSites.mockReturnValue({
      currentData: [],
      isLoading: false,
      error: undefined,
      refetch: vi.fn(),
    });

    const markup = renderToStaticMarkup(
      <ContractSiteManagement companyId="company-1" contract={contract} />,
    );

    expect(markup).toContain("No sites have been added to this contract.");
  });

  it("converts between decimal degrees and stored micro-degrees", () => {
    expect(toMicroDegrees("6.5243793")).toBe(6_524_379);
    expect(toMicroDegrees("-180")).toBe(-180_000_000);
    expect(fromMicroDegrees(-3_379_206)).toBe("-3.379206");
  });
});
