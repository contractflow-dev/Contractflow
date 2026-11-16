"use client";

import { useMemo } from "react";
import {
  STATE_REGION_MAX_LENGTH,
  findCountrySubdivision,
  getCountrySubdivisions,
  getSubdivisionLabel,
} from "@contractflow/contracts-schema/geography";
import { Input } from "@workspace/ui/components/input";
import type { FormControlProps } from "@/components/forms/form-field";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/forms/searchable-select";

export interface StateRegionSelectProps extends Partial<FormControlProps> {
  /** ISO 3166-1 alpha-2 code of the selected country, or `""` for none. */
  countryCode: string;
  /** The subdivision's name, as stored in `stateRegion`. */
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * The state, province or region of the selected country.
 *
 * - No country: disabled until one is chosen.
 * - A country with supported subdivisions: a searchable list of only that
 *   country's subdivisions. A value that is not one of them shows no
 *   selection, so a region of another country can never appear selected.
 * - Any other country: optional free text, so no one has to pick a
 *   subdivision that does not exist.
 */
export function StateRegionSelect({
  countryCode,
  value,
  onValueChange,
  name,
  required = false,
  disabled = false,
  ...control
}: StateRegionSelectProps) {
  const options = useMemo<SearchableSelectOption[]>(
    () =>
      getCountrySubdivisions(countryCode).map((subdivision) => ({
        value: subdivision.name,
        label: subdivision.name,
        keywords: subdivision.code ? [subdivision.code] : [],
      })),
    [countryCode],
  );
  const label = getSubdivisionLabel(countryCode).toLowerCase();

  if (countryCode && options.length === 0) {
    return (
      <Input
        {...control}
        name={name}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={disabled}
        maxLength={STATE_REGION_MAX_LENGTH}
        autoComplete="address-level1"
      />
    );
  }

  return (
    <SearchableSelect
      {...control}
      options={options}
      value={findCountrySubdivision(countryCode, value)?.name ?? ""}
      onValueChange={onValueChange}
      name={name}
      required={required}
      disabled={disabled || !countryCode}
      placeholder={countryCode ? `Select ${label}` : "Select a country first"}
      emptyMessage={`No ${label} matches your search.`}
      autoComplete="address-level1"
    />
  );
}
