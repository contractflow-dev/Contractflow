import { renderToStaticMarkup } from "react-dom/server";
import type { IPaginationMeta } from "@contractflow/contracts-schema";
import { describe, expect, it, vi } from "vitest";
import { DataPagination } from "./data-pagination";

const meta = (overrides: Partial<IPaginationMeta> = {}): IPaginationMeta => ({
  totalItems: 150,
  itemCount: 20,
  itemsPerPage: 20,
  totalPages: 8,
  currentPage: 1,
  ...overrides,
});

function render(
  props: Partial<Parameters<typeof DataPagination>[0]> = {},
): string {
  return renderToStaticMarkup(
    <DataPagination
      meta={meta()}
      onPageChange={vi.fn()}
      itemLabel="contracts"
      {...props}
    />,
  );
}

function buttonTag(markup: string, label: string): string {
  const match = markup.match(
    new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`),
  );
  if (!match) throw new Error(`No button labelled ${label}`);
  return match[0];
}

describe("DataPagination", () => {
  it("summarises the visible rows and marks the current page", () => {
    const markup = render({ meta: meta({ currentPage: 2 }) });

    expect(markup).toContain("Showing 21–40 of 150 contracts");
    expect(buttonTag(markup, "Page 2")).toContain('aria-current="page"');
    expect(buttonTag(markup, "Page 1")).not.toContain("aria-current");
    expect(markup).toContain("More pages");
  });

  it("disables Previous on the first page and Next on the last", () => {
    const first = render();
    expect(buttonTag(first, "Go to previous page")).toContain(' disabled=""');
    expect(buttonTag(first, "Go to next page")).not.toContain(' disabled=""');

    const last = render({ meta: meta({ currentPage: 8, itemCount: 10 }) });
    expect(buttonTag(last, "Go to previous page")).not.toContain(
      ' disabled=""',
    );
    expect(buttonTag(last, "Go to next page")).toContain(' disabled=""');
    expect(last).toContain("Showing 141–150 of 150 contracts");
  });

  it("disables navigation while a page is loading", () => {
    const markup = render({ meta: meta({ currentPage: 3 }), isFetching: true });

    expect(buttonTag(markup, "Go to previous page")).toContain(' disabled=""');
    expect(buttonTag(markup, "Go to next page")).toContain(' disabled=""');
    expect(buttonTag(markup, "Page 1")).toContain(' disabled=""');
  });

  it("offers a labelled page-size control only when it can be changed", () => {
    expect(render()).not.toContain("Rows per page");

    const markup = render({
      meta: meta({ itemsPerPage: 50, totalPages: 3 }),
      onPageSizeChange: vi.fn(),
    });
    expect(markup).toContain("Rows per page");
    expect(markup).toMatch(/<option[^>]*value="50"[^>]*selected=""/);
  });

  it("describes an empty collection with a single disabled page", () => {
    const markup = render({
      meta: meta({ totalItems: 0, itemCount: 0, totalPages: 0 }),
    });

    expect(markup).toContain("No contracts");
    expect(buttonTag(markup, "Go to previous page")).toContain(' disabled=""');
    expect(buttonTag(markup, "Go to next page")).toContain(' disabled=""');
  });
});
