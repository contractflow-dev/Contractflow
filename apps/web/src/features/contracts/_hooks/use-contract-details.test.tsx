// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EContractStatus } from "@contractflow/contracts-schema";
import { useGetContractStatusHistoryQuery } from "@/services/contractApi";
import {
  NO_STATUS_HISTORY_FILTERS,
  toStatusHistoryQuery,
  useContractDetails,
} from "./use-contract-details";

vi.mock("@/services/contractApi", () => ({
  useGetContractByIdQuery: vi.fn(() => ({})),
  useGetContractPartiesQuery: vi.fn(() => ({})),
  useGetContractStatusHistoryQuery: vi.fn(() => ({})),
}));

const lastHistoryQuery = () =>
  vi.mocked(useGetContractStatusHistoryQuery).mock.lastCall?.[0];

beforeEach(() => vi.mocked(useGetContractStatusHistoryQuery).mockClear());

describe("toStatusHistoryQuery", () => {
  it("sends nothing without filters", () => {
    expect(toStatusHistoryQuery(NO_STATUS_HISTORY_FILTERS, "UTC")).toEqual({
      status: undefined,
      fromDate: undefined,
      toDate: undefined,
      rangeError: null,
    });
  });

  it("turns calendar days into the whole days in the viewer's time zone", () => {
    expect(
      toStatusHistoryQuery(
        { status: "", fromDay: "2026-03-01", toDay: "2026-03-31" },
        "Africa/Lagos",
      ),
    ).toMatchObject({
      // Lagos is UTC+1: its day starts an hour before UTC's.
      fromDate: "2026-02-28T23:00:00.000Z",
      toDate: "2026-03-31T22:59:59.999Z",
      rangeError: null,
    });
  });

  it("passes the status, which the API matches as a change to or from it", () => {
    expect(
      toStatusHistoryQuery(
        { ...NO_STATUS_HISTORY_FILTERS, status: EContractStatus.SUSPENDED },
        "UTC",
      ).status,
    ).toBe(EContractStatus.SUSPENDED);
  });

  it("reports a reversed range instead of sending it", () => {
    expect(
      toStatusHistoryQuery(
        { status: "", fromDay: "2026-04-10", toDay: "2026-04-01" },
        "UTC",
      ),
    ).toEqual({
      status: undefined,
      fromDate: undefined,
      toDate: undefined,
      rangeError: "The end date is before the start date.",
    });
  });
});

describe("useContractDetails status history filters", () => {
  it("sends the filters to the API and starts again at page 1", () => {
    const { result } = renderHook(() =>
      useContractDetails(
        { companyId: "company-1", contractId: "contract-1" },
        { timeZone: "UTC" },
      ),
    );
    act(() => result.current.setHistoryPage(3));
    expect(lastHistoryQuery()).toMatchObject({ page: 3 });

    act(() =>
      result.current.setHistoryFilters({
        status: EContractStatus.ACTIVE,
        fromDay: "2026-05-01",
      }),
    );
    expect(lastHistoryQuery()).toMatchObject({
      companyId: "company-1",
      contractId: "contract-1",
      status: EContractStatus.ACTIVE,
      fromDate: "2026-05-01T00:00:00.000Z",
      page: 1,
    });
    expect(result.current.historyFilters.status).toBe(EContractStatus.ACTIVE);

    act(() => result.current.clearHistoryFilters());
    expect(lastHistoryQuery()).toMatchObject({
      status: undefined,
      fromDate: undefined,
      toDate: undefined,
      page: 1,
    });
  });
});
