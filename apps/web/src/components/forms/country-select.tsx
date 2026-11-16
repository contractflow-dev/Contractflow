"use client";

import { countryOptions } from "@/lib/countries";
import {
  SearchableSelect,
  type SearchableSelectOption,
  type SearchableSelectProps,
} from "@/components/forms/searchable-select";

/** Every supported country, alphabetical, searchable by name or ISO code. */
export const countrySelectOptions: readonly SearchableSelectOption[] =
  countryOptions.map(({ code, name }) => ({
    value: code,
    label: name,
    keywords: [code],
  }));

export type CountrySelectProps = Omit<SearchableSelectProps, "options">;

/**
 * Searchable country field. Its value is the ISO 3166-1 alpha-2 code
 * (`NG`, `GB`); the name is only displayed.
 */
export function CountrySelect({
  placeholder = "Select country",
  emptyMessage = "No countries match your search.",
  autoComplete = "country",
  ...props
}: CountrySelectProps) {
  return (
    <SearchableSelect
      {...props}
      options={countrySelectOptions}
      placeholder={placeholder}
      emptyMessage={emptyMessage}
      autoComplete={autoComplete}
    />
  );
}
