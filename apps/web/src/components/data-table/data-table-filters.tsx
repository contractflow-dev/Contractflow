"use client";

import { useId, useState } from "react";
import { RiCloseLine, RiFilter3Line } from "@remixicon/react";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { formatCalendarDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DataTableFilterOption {
  value: string;
  label: string;
  /** The API's total for this option. Omit when there is no reliable count. */
  count?: number;
  /** Puts the option under a heading in the list. */
  group?: string;
}

interface FilterBase {
  /** The key of this filter's value in what `onApply` receives. */
  id: string;
  label: string;
  /** Filters with the same group sit together under that heading. */
  group?: string;
}

/** One choice from a list. The first option with `resetValue` means "all". */
export interface DataTableSelectFilter extends FilterBase {
  kind: "select";
  value: string;
  options: readonly DataTableFilterOption[];
  /** The value meaning no filter. Defaults to the empty string. */
  resetValue?: string;
}

export interface DataTableCheckboxFilter extends FilterBase {
  kind: "checkbox";
  checked: boolean;
}

/** Two calendar days. Their values are `<id>.from` and `<id>.to`. */
export interface DataTableDateRangeFilter extends FilterBase {
  kind: "dateRange";
  from: string;
  to: string;
  /** The latest selectable day, `YYYY-MM-DD`, such as today. */
  max?: string;
  description?: string;
}

export type DataTableFilterField =
  DataTableSelectFilter | DataTableCheckboxFilter | DataTableDateRangeFilter;

/** Every filter's value by key. A checkbox is `"true"` or `""`. */
export type DataTableFilterValues = Record<string, string>;

function appliedValues(
  fields: readonly DataTableFilterField[],
): DataTableFilterValues {
  const values: DataTableFilterValues = {};
  for (const field of fields) {
    if (field.kind === "select") values[field.id] = field.value;
    else if (field.kind === "checkbox") {
      values[field.id] = field.checked ? "true" : "";
    } else {
      values[`${field.id}.from`] = field.from;
      values[`${field.id}.to`] = field.to;
    }
  }
  return values;
}

function clearedValues(field: DataTableFilterField): DataTableFilterValues {
  if (field.kind === "select") {
    return { [field.id]: field.resetValue ?? "" };
  }
  if (field.kind === "checkbox") return { [field.id]: "" };
  return { [`${field.id}.from`]: "", [`${field.id}.to`]: "" };
}

/** How an applied filter reads in the list of active ones, or null if unset. */
function activeLabel(field: DataTableFilterField): string | null {
  if (field.kind === "checkbox") return field.checked ? field.label : null;
  if (field.kind === "select") {
    if (field.value === (field.resetValue ?? "")) return null;
    const option = field.options.find(({ value }) => value === field.value);
    return `${field.label}: ${option?.label ?? "Selected"}`;
  }
  if (!field.from && !field.to) return null;
  const from = field.from ? `from ${formatCalendarDate(field.from)}` : "";
  const to = field.to ? `to ${formatCalendarDate(field.to)}` : "";
  return `${field.label} ${[from, to].filter(Boolean).join(" ")}`;
}

/** The filters in display order, each group once. */
function groupFields(fields: readonly DataTableFilterField[]) {
  const groups: Array<{
    label?: string;
    fields: DataTableFilterField[];
  }> = [];
  for (const field of fields) {
    const group = groups.find(({ label }) => label === field.group);
    if (group) group.fields.push(field);
    else groups.push({ label: field.group, fields: [field] });
  }
  return groups;
}

/**
 * A table's filters, in one dropdown. Each choice applies at once and the
 * dropdown stays open for the next one; a reversed date range waits until it
 * is corrected. Reset clears every filter. The table's owner still holds the
 * applied values and sends them to the API, so server-side filtering and
 * paging work as they did.
 */
export function DataTableFilters({
  label,
  fields,
  onApply,
}: {
  /** What the table lists, such as "contracts". */
  label: string;
  fields: readonly DataTableFilterField[];
  onApply: (values: DataTableFilterValues) => void;
}) {
  const baseId = useId();
  const [open, setOpen] = useState(false);
  const applied = appliedValues(fields);
  const appliedKey = JSON.stringify(applied);
  const [draft, setDraft] = useState(applied);
  const [seenKey, setSeenKey] = useState(appliedKey);
  // What this dropdown last applied, which may reach the table a render later
  // when the filter lives in the URL.
  const [sentKey, setSentKey] = useState(appliedKey);
  // A change made outside (a cleared empty state, a link) replaces the draft.
  // The dropdown's own keeps it, so a date range being corrected isn't lost.
  if (seenKey !== appliedKey) {
    setSeenKey(appliedKey);
    if (appliedKey !== sentKey) setDraft(applied);
  }

  const active = fields.flatMap((field) => {
    const text = activeLabel(field);
    return text ? [{ field, text }] : [];
  });
  const unapplied = JSON.stringify(draft) !== appliedKey;

  function change(patch: DataTableFilterValues) {
    const next = { ...draft, ...patch };
    setDraft(next);
    // A reversed range stays as it was applied; every other choice still counts.
    const values = { ...next };
    for (const field of fields) {
      if (field.kind !== "dateRange") continue;
      const fromKey = `${field.id}.from`;
      const toKey = `${field.id}.to`;
      if (next[fromKey] && next[toKey] && next[fromKey] > next[toKey]) {
        values[fromKey] = applied[fromKey];
        values[toKey] = applied[toKey];
      }
    }
    const key = JSON.stringify(values);
    // Nothing new to apply: stay on the current page of results.
    if (key === appliedKey) return;
    setSentKey(key);
    onApply(values);
  }

  function reset() {
    const cleared = Object.assign({}, ...fields.map(clearedValues));
    setDraft(cleared);
    setSentKey(JSON.stringify(cleared));
    onApply(cleared);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: "outline" }),
          "shrink-0 self-start sm:self-auto",
        )}
      >
        <RiFilter3Line aria-hidden="true" data-icon="inline-start" />
        Filters
        {active.length > 0 ? (
          <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">
            {active.length}
            <span className="sr-only"> active</span>
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-(--available-height) w-[min(24rem,calc(100vw-2rem))] overflow-y-auto"
      >
        <PopoverHeader>
          <PopoverTitle>Filter {label}</PopoverTitle>
        </PopoverHeader>

        {active.length ? (
          <ul aria-label="Active filters" className="flex flex-wrap gap-1.5">
            {active.map(({ field, text }) => (
              <li key={field.id} className="max-w-full">
                <span className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/50 py-0.5 ps-3 pe-1 text-xs font-medium">
                  <span className="truncate">{text}</span>
                  <button
                    type="button"
                    aria-label={`Remove filter: ${text}`}
                    onClick={() =>
                      onApply({ ...applied, ...clearedValues(field) })
                    }
                    className="grid size-5 shrink-0 place-items-center rounded-full outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
                  >
                    <RiCloseLine aria-hidden="true" className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-col gap-4">
          {groupFields(fields).map((group, index) => (
            <fieldset
              key={group.label ?? index}
              className={cn(
                "min-w-0 space-y-3",
                index > 0 && group.label && "border-t pt-3",
              )}
            >
              {group.label ? (
                <legend className="float-left mb-3 w-full text-xs font-medium text-muted-foreground">
                  {group.label}
                </legend>
              ) : null}
              <div className="clear-both space-y-3">
                {group.fields.map((field) => (
                  <FilterControl
                    key={field.id}
                    id={`${baseId}-${field.id}`}
                    field={field}
                    draft={draft}
                    onChange={change}
                  />
                ))}
              </div>
            </fieldset>
          ))}

          <div className="flex items-center justify-end border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!active.length && !unapplied}
              onClick={reset}
            >
              Reset
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FilterControl({
  id,
  field,
  draft,
  onChange,
}: {
  id: string;
  field: DataTableFilterField;
  draft: DataTableFilterValues;
  onChange: (patch: DataTableFilterValues) => void;
}) {
  if (field.kind === "checkbox") {
    return (
      <Field orientation="horizontal">
        <Checkbox
          id={id}
          checked={draft[field.id] === "true"}
          onCheckedChange={(checked) =>
            onChange({ [field.id]: checked === true ? "true" : "" })
          }
        />
        <FieldLabel htmlFor={id} className="font-normal">
          {field.label}
        </FieldLabel>
      </Field>
    );
  }

  if (field.kind === "dateRange") {
    const fromKey = `${field.id}.from`;
    const toKey = `${field.id}.to`;
    const from = draft[fromKey] ?? "";
    const to = draft[toKey] ?? "";
    const reversed = Boolean(from && to && from > to);
    const errorId = `${id}-error`;
    return (
      <fieldset className="min-w-0 space-y-1.5">
        <legend className="text-sm font-medium">{field.label}</legend>
        {field.description ? (
          <p className="text-xs text-muted-foreground">{field.description}</p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${id}-from`}>From</FieldLabel>
            <Input
              id={`${id}-from`}
              type="date"
              value={from}
              max={to || field.max}
              aria-invalid={reversed || undefined}
              aria-describedby={reversed ? errorId : undefined}
              onChange={(event) => onChange({ [fromKey]: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-to`}>To</FieldLabel>
            <Input
              id={`${id}-to`}
              type="date"
              value={to}
              min={from || undefined}
              max={field.max}
              aria-invalid={reversed || undefined}
              aria-describedby={reversed ? errorId : undefined}
              onChange={(event) => onChange({ [toKey]: event.target.value })}
            />
          </Field>
        </div>
        {reversed ? (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            The end date can&apos;t be before the start date.
          </p>
        ) : null}
      </fieldset>
    );
  }

  const groups = [
    ...new Set(field.options.flatMap(({ group }) => (group ? [group] : []))),
  ];
  const option = (entry: DataTableFilterOption) => (
    <NativeSelectOption key={entry.value} value={entry.value}>
      {entry.count === undefined
        ? entry.label
        : `${entry.label} (${entry.count})`}
    </NativeSelectOption>
  );
  return (
    <Field>
      <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      <NativeSelect
        id={id}
        className="w-full"
        value={draft[field.id] ?? field.resetValue ?? ""}
        onChange={(event) => onChange({ [field.id]: event.target.value })}
      >
        {field.options.filter(({ group }) => !group).map(option)}
        {groups.map((group) => (
          <NativeSelectOptGroup key={group} label={group}>
            {field.options.filter((entry) => entry.group === group).map(option)}
          </NativeSelectOptGroup>
        ))}
      </NativeSelect>
    </Field>
  );
}
