"use client";

import { useMemo } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox";
import type { FormControlProps } from "@/components/forms/form-field";

export interface SearchableSelectOption {
  /** The value stored in the form. */
  value: string;
  label: string;
  /** Extra search terms, such as a code, matched like the label. */
  keywords?: readonly string[];
}

export interface SearchableSelectProps extends Partial<FormControlProps> {
  options: readonly SearchableSelectOption[];
  /** The selected option's value; `""` or a value not in `options` shows none. */
  value: string;
  onValueChange: (value: string) => void;
  /** Submits the selected value under this name in native form data. */
  name?: string;
  placeholder?: string;
  /** Shown when the search matches no options. */
  emptyMessage?: string;
  disabled?: boolean;
  /** Options are still loading: the field is disabled and says so. */
  loading?: boolean;
  /** Shows a button that clears the selection. */
  clearable?: boolean;
  required?: boolean;
  autoComplete?: string;
}

/** Case- and accent-insensitive text used for matching a search. */
function searchText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Whether `option` matches a search `query` by label or keyword. */
export function optionMatchesSearch(
  option: SearchableSelectOption,
  query: string,
): boolean {
  const needle = searchText(query);
  if (!needle) return true;
  return [option.label, ...(option.keywords ?? [])].some((text) =>
    searchText(text).includes(needle),
  );
}

/**
 * A single-select field whose options can be searched by typing: the
 * ContractFlow combobox for lists too long for a native select (countries,
 * states). Arrow keys move through matches, Enter selects, Escape closes.
 */
export function SearchableSelect({
  options,
  value,
  onValueChange,
  name,
  placeholder = "Select an option",
  emptyMessage = "No matches found.",
  disabled = false,
  loading = false,
  clearable = false,
  required = false,
  autoComplete,
  id,
  ...aria
}: SearchableSelectProps) {
  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const inactive = disabled || loading;

  return (
    <Combobox<SearchableSelectOption>
      items={options}
      value={selected}
      onValueChange={(option) => onValueChange(option?.value ?? "")}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      isItemEqualToValue={(option, current) => option.value === current.value}
      filter={(option, query) => optionMatchesSearch(option, query)}
      name={name}
      required={required}
      disabled={inactive}
      autoComplete={autoComplete}
      autoHighlight
    >
      <ComboboxInput
        id={id}
        {...aria}
        className="w-full"
        placeholder={loading ? "Loading…" : placeholder}
        disabled={inactive}
        showClear={clearable && selected !== null && !inactive}
        aria-busy={loading || undefined}
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
        <ComboboxList>
          {(option: SearchableSelectOption) => (
            <ComboboxItem key={option.value} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
