import { describe, expect, it } from "vitest";
import {
  describePageWindow,
  getPageRange,
  initialPaginationState,
  pageInRange,
  withPageSize,
} from "./pagination";

const meta = (overrides: Partial<Parameters<typeof pageInRange>[0]> = {}) => ({
  totalItems: 150,
  itemCount: 20,
  itemsPerPage: 20,
  totalPages: 8,
  currentPage: 1,
  ...overrides,
});

describe("pagination state", () => {
  it("starts on the first page with the default page size", () => {
    expect(initialPaginationState()).toEqual({ page: 1, limit: 20 });
    expect(initialPaginationState(10)).toEqual({ page: 1, limit: 10 });
  });

  it("returns to page 1 when the page size changes", () => {
    expect(withPageSize({ page: 4, limit: 20 }, 50)).toEqual({
      page: 1,
      limit: 50,
    });
  });

  it("keeps the same state object when nothing changes", () => {
    const state = { page: 1, limit: 20 };

    expect(withPageSize(state, 20)).toBe(state);
  });
});

describe("pageInRange", () => {
  it("moves back to the last page when the current page no longer exists", () => {
    expect(pageInRange(meta({ currentPage: 9, itemCount: 0 }))).toBe(8);
  });

  it("leaves valid and empty collections alone", () => {
    expect(pageInRange(meta({ currentPage: 8 }))).toBeNull();
    expect(
      pageInRange(meta({ totalItems: 0, totalPages: 0, itemCount: 0 })),
    ).toBeNull();
    expect(pageInRange(undefined)).toBeNull();
  });
});

describe("getPageRange", () => {
  it("lists every page when there are few", () => {
    expect(getPageRange(1, 1)).toEqual([1]);
    expect(getPageRange(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses distant pages into ellipses", () => {
    expect(getPageRange(1, 8)).toEqual([1, 2, "ellipsis-end", 8]);
    expect(getPageRange(5, 10)).toEqual([
      1,
      "ellipsis-start",
      4,
      5,
      6,
      "ellipsis-end",
      10,
    ]);
    expect(getPageRange(10, 10)).toEqual([1, "ellipsis-start", 9, 10]);
  });

  it("shows a single hidden page instead of an ellipsis", () => {
    expect(getPageRange(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("returns nothing for an empty collection", () => {
    expect(getPageRange(1, 0)).toEqual([]);
  });
});

describe("describePageWindow", () => {
  it("reports the rows shown on a middle and a partial last page", () => {
    expect(describePageWindow(meta({ currentPage: 2 }))).toEqual({
      first: 21,
      last: 40,
      total: 150,
    });
    expect(describePageWindow(meta({ currentPage: 8, itemCount: 10 }))).toEqual(
      { first: 141, last: 150, total: 150 },
    );
  });

  it("reports zero rows for an empty page", () => {
    expect(
      describePageWindow(meta({ totalItems: 0, totalPages: 0, itemCount: 0 })),
    ).toEqual({ first: 0, last: 0, total: 0 });
  });
});
