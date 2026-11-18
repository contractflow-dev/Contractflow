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
import { DataPagination } from "@/components/pagination/data-pagination";
import { cn } from "@/lib/utils";

/**
 * The bordered, rounded frame around the `Table` primitives, named for
 * assistive technology. `DataTable` below uses it; use it directly only for a
 * table whose layout the column configuration can't express.
 */
export function DataTableFrame({
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

/** Hides a lower-priority column below a width (static classes for Tailwind). */
const HIDE_BELOW = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
} as const;

/** One column of a `DataTable`, defined by the feature that owns the data. */
export interface DataTableColumn<TRow> {
  /** Stable identifier; also what `sort.onSort` receives. */
  id: string;
  header: string;
  cell: (row: TRow) => ReactNode;
  /** Money, percentages and counts: right aligned, in tabular figures. */
  numeric?: boolean;
  /** Only for columns the API can sort by; the feature maps the id. */
  sortable?: boolean;
  /** Long text such as names, emails and addresses wraps instead of widening the table. */
  wrap?: boolean;
  /** A lower-priority column, hidden below this width. */
  hideBelow?: keyof typeof HIDE_BELOW;
  /** Extra cell classes, such as a minimum width. */
  className?: string;
}

export interface DataTableSort {
  /** The column the rows are sorted by, if it is one of the table's. */
  columnId: string | null;
  direction: SortDirection;
  onSort: (columnId: string) => void;
}

/**
 * A data table from a column configuration: the table itself (and, with
 * `renderCard`, a card list below md instead), its loading skeleton, error
 * with Retry, empty state, row actions and pagination, in the shared
 * standard (UI guide §7.3).
 *
 * The feature owns everything with meaning: the rows and their query, the
 * columns, which of them sort and how that maps to the API, the actions a
 * user may see, and what an empty table should say. Nothing here filters,
 * sorts or pages in the browser.
 */
export function DataTable<TRow>({
  label,
  columns,
  rows,
  getRowKey,
  getRowProps,
  sort,
  rowActions,
  renderCard,
  isLoading = false,
  loadingLabel,
  skeletonRows,
  error,
  onRetry,
  empty,
  pagination,
}: {
  /** The table's accessible name, such as "Contracts". */
  label: string;
  columns: ReadonlyArray<DataTableColumn<TRow>>;
  rows: readonly TRow[];
  getRowKey: (row: TRow) => string;
  /** Per-row attributes, such as a deep-link `id` and its highlight. */
  getRowProps?: (row: TRow) => { id?: string; className?: string };
  sort?: DataTableSort;
  /** A row's actions, normally a `DataTableRowActions` menu; omit for none. */
  rowActions?: (row: TRow) => ReactNode;
  /**
   * A row as a card on phones. Omit to keep one table at every width (for
   * example when rows are deep-link targets) and use `hideBelow` instead.
   */
  renderCard?: (row: TRow) => ReactNode;
  /** The first load only; refetches keep the current rows. */
  isLoading?: boolean;
  /** Announced while loading, such as "Loading contracts…". */
  loadingLabel: string;
  skeletonRows?: number;
  /** A failed load's message. With it, the table shows the error, never rows. */
  error?: string | null;
  onRetry?: () => void;
  /** What to show without rows: say whether nothing exists or nothing matches. */
  empty: ReactNode;
  pagination?: ComponentProps<typeof DataPagination>;
}) {
  if (error) {
    return <DataTableError message={error} onRetry={() => onRetry?.()} />;
  }
  if (isLoading) {
    return (
      <DataTableSkeleton
        label={loadingLabel}
        columns={[
          ...columns.map((column) => column.header),
          ...(rowActions ? [""] : []),
        ]}
        rows={skeletonRows}
      />
    );
  }
  if (!rows.length) return <>{empty}</>;

  return (
    <div className="space-y-4">
      {renderCard ? (
        <ul aria-label={label} className="divide-y rounded-xl border md:hidden">
          {rows.map((row) => (
            <li key={getRowKey(row)} className="space-y-2 p-4">
              {renderCard(row)}
            </li>
          ))}
        </ul>
      ) : null}
      <DataTableFrame
        label={label}
        className={renderCard ? "hidden md:block" : undefined}
      >
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => {
              const hidden = column.hideBelow
                ? HIDE_BELOW[column.hideBelow]
                : undefined;
              return column.sortable && sort ? (
                <SortableTableHead
                  key={column.id}
                  label={column.header}
                  align={column.numeric ? "end" : "start"}
                  className={hidden}
                  direction={
                    sort.columnId === column.id ? sort.direction : null
                  }
                  onSort={() => sort.onSort(column.id)}
                />
              ) : (
                <TableHead
                  key={column.id}
                  className={cn(column.numeric && "text-end", hidden)}
                >
                  {column.header}
                </TableHead>
              );
            })}
            {rowActions ? <ActionsTableHead /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const { id, className } = getRowProps?.(row) ?? {};
            return (
              <TableRow key={getRowKey(row)} id={id} className={className}>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(
                      column.numeric && "text-end tabular-nums",
                      column.wrap && "whitespace-normal break-words",
                      column.hideBelow && HIDE_BELOW[column.hideBelow],
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
                {rowActions ? (
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-2">
                      {rowActions(row)}
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </DataTableFrame>
      {pagination ? <DataPagination {...pagination} /> : null}
    </div>
  );
}
