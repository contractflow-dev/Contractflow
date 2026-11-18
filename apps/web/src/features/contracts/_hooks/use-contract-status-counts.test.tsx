// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EContractStatus } from "@contractflow/contracts-schema";
import { useGetContractsQuery } from "@/services/contractApi";
import {
  CONTRACT_STATUS_FILTERS,
  useContractStatusCounts,
} from "./use-contract-status-counts";

vi.mock("@/services/contractApi", () => ({
  useGetContractsQuery: vi.fn(),
}));

const totals: Record<string, number | undefined> = {
  all: 12,
  [EContractStatus.ACTIVE]: 7,
  [EContractStatus.DRAFT]: 3,
  [EContractStatus.SUSPENDED]: undefined,
  [EContractStatus.COMPLETED]: 2,
};

const queryArgs = () =>
  vi.mocked(useGetContractsQuery).mock.calls.map(([args]) => args);

beforeEach(() => {
  vi.mocked(useGetContractsQuery).mockReset();
  vi.mocked(useGetContractsQuery).mockImplementation(((args: {
    status?: string;
  }) => {
    const total = totals[args.status ?? "all"];
    return {
      currentData:
        total === undefined
          ? undefined
          : { data: [], meta: { totalItems: total } },
    };
  }) as never);
});

describe("useContractStatusCounts", () => {
  it("counts each status filter with the list's own scope and search, one row each", () => {
    renderHook(() =>
      useContractStatusCounts("company-1", {
        search: "jetty",
        includeDeleted: false,
      }),
    );

    const calls = queryArgs();
    expect(calls).toHaveLength(CONTRACT_STATUS_FILTERS.length);
    for (const args of calls) {
      expect(args).toMatchObject({
        companyId: "company-1",
        search: "jetty",
        includeDeleted: false,
        page: 1,
        limit: 1,
      });
    }
    expect(calls.map((args) => (args as { status?: string }).status)).toEqual([
      undefined,
      EContractStatus.ACTIVE,
      EContractStatus.DRAFT,
      EContractStatus.SUSPENDED,
      EContractStatus.COMPLETED,
    ]);
  });

  it("returns the API's totals, and nothing where it has no answer", () => {
    const { result } = renderHook(() =>
      useContractStatusCounts("company-1", {
        search: "",
        includeDeleted: true,
      }),
    );
    expect(result.current).toEqual({
      "": 12,
      [EContractStatus.ACTIVE]: 7,
      [EContractStatus.DRAFT]: 3,
      [EContractStatus.SUSPENDED]: undefined,
      [EContractStatus.COMPLETED]: 2,
    });
  });

  it("counts archived contracts only when the list shows them, and the user's own when asked", () => {
    renderHook(() =>
      useContractStatusCounts("company-1", {
        search: "",
        includeDeleted: true,
        assignedToMe: true,
      }),
    );
    for (const args of queryArgs()) {
      expect(args).toMatchObject({ includeDeleted: true, assignedToMe: true });
      // An empty search isn't sent.
      expect((args as { search?: string }).search).toBeUndefined();
    }
  });
});
