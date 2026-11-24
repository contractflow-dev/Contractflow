"use client";

import type { FormEvent, ReactNode } from "react";
import { RiCloseLine, RiSearchLine } from "@remixicon/react";
import { Input } from "@workspace/ui/components/input";

/**
 * The row of controls above a table: search and the Filters dropdown on the
 * left, table-level actions such as sorting on the right.
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
