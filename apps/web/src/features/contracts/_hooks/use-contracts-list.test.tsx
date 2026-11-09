import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EContractSortField, ESortOrder } from "@contractflow/contracts-schema";
import { useGetContractsQuery } from "@/services/contractApi";
import { useContractsList } from "./use-contracts-list";

vi.mock("@/services/contractApi", () => ({
  useGetContractsQuery: vi.fn(() => ({ currentData: undefined })),
}));

function Probe({ canViewArchived }: { canViewArchived: boolean }) {
  useContractsList("company-1", { canViewArchived });
  return null;
}

describe("useContractsList", () => {
  it("asks the server for the first page, newest first, with no filters", () => {
    renderToStaticMarkup(<Probe canViewArchived />);

    expect(vi.mocked(useGetContractsQuery)).toHaveBeenLastCalledWith({
      companyId: "company-1",
      search: undefined,
      status: undefined,
      includeDeleted: false,
      sortBy: EContractSortField.CREATED_AT,
      sortOrder: ESortOrder.DESC,
      page: 1,
      limit: expect.any(Number),
    });
  });

  it("never asks for archived contracts without administrator access", () => {
    renderToStaticMarkup(<Probe canViewArchived={false} />);

    expect(vi.mocked(useGetContractsQuery)).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeDeleted: false }),
    );
  });

  it("asks for the user's own contracts only when told to", () => {
    renderToStaticMarkup(<Probe canViewArchived={false} />);
    expect(vi.mocked(useGetContractsQuery).mock.lastCall?.[0]).not.toHaveProperty(
      "assignedToMe",
      true,
    );

    function Mine() {
      useContractsList("company-1", { canViewArchived: false, assignedToMe: true });
      return null;
    }
    renderToStaticMarkup(<Mine />);
    expect(vi.mocked(useGetContractsQuery)).toHaveBeenLastCalledWith(
      expect.objectContaining({ companyId: "company-1", assignedToMe: true }),
    );
  });
});
