// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EContractSortField, ESortOrder } from "@contractflow/contracts-schema";
import { useGetContractsQuery } from "@/services/contractApi";
import { useContractsList } from "./use-contracts-list";

vi.mock("@/services/contractApi", () => ({
  useGetContractsQuery: vi.fn(() => ({ currentData: undefined })),
}));

const lastQuery = () => vi.mocked(useGetContractsQuery).mock.lastCall?.[0];

beforeEach(() => vi.mocked(useGetContractsQuery).mockClear());

describe("useContractsList sorting from column headers", () => {
  it("sorts by a column ascending, then flips it, starting again at page 1", () => {
    const { result } = renderHook(() =>
      useContractsList("company-1", { canViewArchived: true }),
    );
    act(() => result.current.setPage(3));

    act(() => result.current.toggleSort(EContractSortField.START_DATE));
    expect(lastQuery()).toMatchObject({
      sortBy: EContractSortField.START_DATE,
      sortOrder: ESortOrder.ASC,
      page: 1,
    });
    expect(result.current.sort).toBe("start-date");

    act(() => result.current.toggleSort(EContractSortField.START_DATE));
    expect(lastQuery()).toMatchObject({
      sortBy: EContractSortField.START_DATE,
      sortOrder: ESortOrder.DESC,
    });
    expect(result.current.sortBy).toBe(EContractSortField.START_DATE);
    expect(result.current.sortOrder).toBe(ESortOrder.DESC);

    // Another column starts ascending again.
    act(() => result.current.toggleSort(EContractSortField.STATUS));
    expect(lastQuery()).toMatchObject({
      sortBy: EContractSortField.STATUS,
      sortOrder: ESortOrder.ASC,
    });
  });

  it("offers both directions for every sortable column", () => {
    const { result } = renderHook(() =>
      useContractsList("company-1", { canViewArchived: true }),
    );
    for (const field of [
      EContractSortField.TITLE,
      EContractSortField.STATUS,
      EContractSortField.START_DATE,
      EContractSortField.END_DATE,
      EContractSortField.REFERENCE_NUMBER,
    ]) {
      act(() => result.current.toggleSort(field));
      expect(lastQuery()).toMatchObject({
        sortBy: field,
        sortOrder: ESortOrder.ASC,
      });
      act(() => result.current.toggleSort(field));
      expect(lastQuery()).toMatchObject({
        sortBy: field,
        sortOrder: ESortOrder.DESC,
      });
    }
  });
});

describe("useContractsList search", () => {
  it("clears the search and returns to page 1, keeping the status filter", () => {
    const { result } = renderHook(() =>
      useContractsList("company-1", { canViewArchived: true }),
    );
    act(() => result.current.setSearchInput("jetty"));
    act(() =>
      result.current.submitSearch({
        preventDefault: () => undefined,
      } as never),
    );
    act(() => result.current.setStatus("active" as never));
    act(() => result.current.setPage(2));
    expect(lastQuery()).toMatchObject({ search: "jetty", page: 2 });

    act(() => result.current.clearSearch());
    expect(result.current.searchInput).toBe("");
    expect(lastQuery()).toMatchObject({
      search: undefined,
      status: "active",
      page: 1,
    });
  });
});
