"use client";

import { useId } from "react";
import type { IPaginationMeta } from "@contractflow/contracts-schema";
import { RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@workspace/ui/components/pagination";
import { cn } from "@/lib/utils";
import {
  PAGE_SIZE_OPTIONS,
  describePageWindow,
  getPageRange,
} from "@/lib/pagination";

interface DataPaginationProps {
  meta: IPaginationMeta;
  onPageChange: (page: number) => void;
  /** Omit to hide the rows-per-page control. */
  onPageSizeChange?: (limit: number) => void;
  /** Plural noun for the summary, e.g. "contracts". */
  itemLabel?: string;
  /** Disables navigation while a page request is in flight. */
  isFetching?: boolean;
  pageSizeOptions?: number[];
  className?: string;
}

export function DataPagination({
  meta,
  onPageChange,
  onPageSizeChange,
  itemLabel = "records",
  isFetching = false,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className,
}: DataPaginationProps) {
  const pageSizeId = useId();
  const { first, last, total } = describePageWindow(meta);
  const totalPages = Math.max(1, meta.totalPages);
  const currentPage = Math.min(meta.currentPage, totalPages);
  const pages = getPageRange(currentPage, totalPages);
  const sizes = pageSizeOptions.includes(meta.itemsPerPage)
    ? pageSizeOptions
    : [...pageSizeOptions, meta.itemsPerPage].sort((a, b) => a - b);

  return (
    <div
      data-slot="data-pagination"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <p aria-live="polite" className="tabular-nums">
          {total === 0
            ? `No ${itemLabel}`
            : `Showing ${first}–${last} of ${total} ${itemLabel}`}
        </p>
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <label htmlFor={pageSizeId}>Rows per page</label>
            <NativeSelect
              id={pageSizeId}
              size="sm"
              // The row's muted text colour would otherwise reach the
              // selected value (4.1:1 on the input fill).
              className="text-foreground"
              value={String(meta.itemsPerPage)}
              disabled={isFetching}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {sizes.map((size) => (
                <NativeSelectOption key={size} value={String(size)}>
                  {size}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </div>

      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
        <PaginationContent className="flex-wrap">
          <PaginationItem>
            <Button
              type="button"
              variant="ghost"
              aria-label="Go to previous page"
              disabled={currentPage <= 1 || isFetching}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <RiArrowLeftSLine data-icon="inline-start" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
          </PaginationItem>
          {pages.map((page) =>
            typeof page === "number" ? (
              <PaginationItem key={page}>
                <Button
                  type="button"
                  size="icon"
                  variant={page === currentPage ? "outline" : "ghost"}
                  aria-label={`Page ${page}`}
                  aria-current={page === currentPage ? "page" : undefined}
                  disabled={isFetching && page !== currentPage}
                  onClick={() => {
                    if (page !== currentPage) onPageChange(page);
                  }}
                >
                  {page}
                </Button>
              </PaginationItem>
            ) : (
              <PaginationItem key={page} className="hidden sm:block">
                <PaginationEllipsis />
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <Button
              type="button"
              variant="ghost"
              aria-label="Go to next page"
              disabled={currentPage >= totalPages || isFetching}
              onClick={() => onPageChange(currentPage + 1)}
            >
              <span className="hidden sm:inline">Next</span>
              <RiArrowRightSLine data-icon="inline-end" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
