"use client";

import type { ComponentProps, ReactNode } from "react";
import {
  RiArrowDownLine,
  RiArrowUpDownLine,
  RiArrowUpLine,
  RiMore2Fill,
} from "@remixicon/react";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { cn } from "@/lib/utils";

/**
 * The shared presentation for data tables: a bordered, rounded frame around
 * the `Table` primitives, named for assistive technology. Features keep their
 * own columns, queries, filters, permissions and row actions.
 *
 * On phones, show a card list instead (`md:hidden`) and give this
 * `className="hidden md:block"` (UI guide §4.4).
 */
export function DataTable({
  label,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Table>, "aria-label"> & {
  /** The table's accessible name, such as "Contracts". */
  label: string;
}) {
  return (
    <div
      data-slot="data-table"
      className={cn("overflow-hidden rounded-xl border bg-card", className)}
    >
      <Table aria-label={label} {...props}>
        {children}
      </Table>
    </div>
  );
}

export type SortDirection = "asc" | "desc";

/**
 * A column header that sorts the table. Use it only for columns the API can
 * sort by. The header carries `aria-sort`, so its state is announced with
 * the column; the button inside makes it keyboard operable.
 */
export function SortableTableHead({
  label,
  direction,
  onSort,
  align = "start",
  className,
}: {
  label: string;
  /** The current direction when the table is sorted by this column. */
  direction: SortDirection | null;
  onSort: () => void;
  align?: "start" | "end";
  className?: string;
}) {
  const Icon =
    direction === "asc"
      ? RiArrowUpLine
      : direction === "desc"
        ? RiArrowDownLine
        : RiArrowUpDownLine;
  return (
    <TableHead
      aria-sort={
        direction === "asc"
          ? "ascending"
          : direction === "desc"
            ? "descending"
            : "none"
      }
      className={cn(align === "end" && "text-end", className)}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "-mx-1.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 font-semibold outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30",
          align === "end" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0",
            direction ? "text-foreground" : "text-muted-foreground",
          )}
        />
      </button>
    </TableHead>
  );
}

/** A header cell for the row-actions column: right aligned, named for screen readers. */
export function ActionsTableHead() {
  return (
    <TableHead className="w-0 text-end">
      <span className="sr-only">Actions</span>
    </TableHead>
  );
}

/**
 * A row's secondary actions behind a three-dot menu. Pass only the items the
 * user's permissions allow; the API still decides. Put any destructive item
 * behind a confirmation.
 */
export function DataTableRowActions({
  label,
  children,
}: {
  /** Names the menu and its row, such as "Actions for CTR-001". */
  label: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label={label}
        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
      >
        <RiMore2Fill aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Skeleton rows shaped like the table (and cards on phones), shown on the
 * first load only. Announced once as `label`.
 */
export function DataTableSkeleton({
  label,
  columns,
  rows = 5,
}: {
  /** Announced while loading, such as "Loading contracts…". */
  label: string;
  /** The table's column headings, so the layout doesn't shift on load. */
  columns: readonly string[];
  rows?: number;
}) {
  return (
    <div role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <ul aria-hidden="true" className="space-y-3 md:hidden">
        {Array.from({ length: rows }, (_, row) => (
          <li key={row} className="space-y-2 rounded-xl border p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-full" />
          </li>
        ))}
      </ul>
      <div
        aria-hidden="true"
        className="hidden overflow-hidden rounded-xl border md:block"
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column, index) => (
                <TableHead key={`${column}-${index}`}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, row) => (
              <TableRow key={row} className="hover:bg-transparent">
                {columns.map((column, index) => (
                  <TableCell key={`${column}-${index}`}>
                    <Skeleton className="h-4 w-full max-w-32" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * The table's empty state: either nothing exists yet, or nothing matches the
 * search and filters. Say which, and offer the relevant action.
 */
export function DataTableEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** A failed load: the message and a Retry, never an empty table. */
export function DataTableError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        <Button type="button" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}
