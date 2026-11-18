"use client";

import { useId, type FormEvent, type ReactNode } from "react";
import { RiCloseLine, RiFilter3Line, RiSearchLine } from "@remixicon/react";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { cn } from "@/lib/utils";

export interface DataTableFilterOption<TValue extends string> {
  value: TValue;
  label: string;
  /** The API's total for this filter. Omit when there is no reliable count. */
  count?: number;
}

/**
 * Predefined filters above a table, one selected at a time. Each is a toggle
 * button (`aria-pressed`), so the selected one is announced and every one is
 * reachable with Tab. Counts come from the API; leave them out rather than
 * estimate.
 */
export function DataTableFilterChips<TValue extends string>({
  label,
  options,
  value,
  onChange,
  countNoun,
}: {
  /** Names the group, such as "Contract status". */
  label: string;
  options: ReadonlyArray<DataTableFilterOption<TValue>>;
  value: TValue;
  onChange: (value: TValue) => void;
  /** Read after each count, such as "contracts". */
  countNoun: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted",
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <>
                <span
                  aria-hidden="true"
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums",
                    selected
                      ? "bg-primary-foreground/20"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {option.count}
                </span>
                <span className="sr-only">
                  , {option.count} {countNoun}
                </span>
              </>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The row of controls between the filters and the table: search and More
 * filters on the left, table-level actions on the right.
 */
export function DataTableToolbar({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        {children}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/**
 * Server-side search for a table. The caller debounces typing; Enter submits
 * straight away, and the clear button empties it.
 */
export function DataTableSearch({
  id,
  label,
  formLabel,
  value,
  placeholder,
  maxLength = 100,
  onChange,
  onSubmit,
  onClear,
}: {
  id: string;
  /** The input's label, such as "Search contracts". Visually hidden. */
  label: string;
  /** Names the search landmark, such as "Contracts". */
  formLabel: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
}) {
  return (
    <form
      role="search"
      aria-label={formLabel}
      onSubmit={onSubmit}
      className="relative w-full sm:max-w-sm"
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <RiSearchLine
        aria-hidden="true"
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id={id}
        type="search"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        className="ps-9 pe-10 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={onClear}
          className="absolute end-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <RiCloseLine aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </form>
  );
}

/**
 * Less-used filters in a popover. The trigger shows how many are active, and
 * the popover can clear them. Put only filters the API applies here.
 */
export function DataTableMoreFilters({
  activeCount,
  onClear,
  children,
}: {
  activeCount: number;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
      >
        <RiFilter3Line aria-hidden="true" data-icon="inline-start" />
        More filters
        {activeCount > 0 ? (
          <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">
            {activeCount}
            <span className="sr-only"> active</span>
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)]">
        <PopoverHeader>
          <PopoverTitle>More filters</PopoverTitle>
        </PopoverHeader>
        {children}
        {activeCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={onClear}
          >
            Clear these filters
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

/**
 * The filters currently applied besides the predefined ones, each removable,
 * with Clear all once more than one is active.
 */
export function DataTableActiveFilters({
  filters,
  onClearAll,
}: {
  filters: readonly ActiveFilter[];
  onClearAll: () => void;
}) {
  if (filters.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Filtered by</span>
      <ul className="contents">
        {filters.map((filter) => (
          <li key={filter.key}>
            <span className="inline-flex h-7 items-center gap-1 rounded-full border bg-muted/50 ps-3 pe-1 text-xs font-medium">
              {filter.label}
              <button
                type="button"
                aria-label={`Remove filter: ${filter.label}`}
                onClick={filter.onRemove}
                className="grid size-5 place-items-center rounded-full outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <RiCloseLine aria-hidden="true" className="size-3.5" />
              </button>
            </span>
          </li>
        ))}
      </ul>
      {filters.length > 1 ? (
        <Button type="button" variant="ghost" size="xs" onClick={onClearAll}>
          Clear all
        </Button>
      ) : null}
    </div>
  );
}

/**
 * A date range for a table's toolbar: two labelled calendar-day inputs, from
 * and to. The feature turns the days into the API's instants (for example
 * with `dayBoundsInTimeZone`) and reports a reversed range as `error`.
 */
export function DataTableDateRange({
  legend,
  from,
  to,
  max,
  error,
  onFromChange,
  onToChange,
}: {
  /** Names the pair, such as "Changed between". */
  legend: string;
  from: string;
  to: string;
  /** The latest selectable day, `YYYY-MM-DD`, such as today. */
  max?: string;
  error?: string | null;
  onFromChange: (day: string) => void;
  onToChange: (day: string) => void;
}) {
  const fromId = useId();
  const toId = useId();
  const errorId = useId();
  return (
    <fieldset className="min-w-0 space-y-1.5">
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field className="sm:w-44">
          <FieldLabel htmlFor={fromId}>From</FieldLabel>
          <Input
            id={fromId}
            type="date"
            value={from}
            max={to || max}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => onFromChange(event.target.value)}
          />
        </Field>
        <Field className="sm:w-44">
          <FieldLabel htmlFor={toId}>To</FieldLabel>
          <Input
            id={toId}
            type="date"
            value={to}
            min={from || undefined}
            max={max}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => onToChange(event.target.value)}
          />
        </Field>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
