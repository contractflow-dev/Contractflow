"use client";

import {
  findCountrySubdivision,
  getSubdivisionLabel,
  hasCountrySubdivisions,
} from "@contractflow/contracts-schema/geography";
import { FormField } from "@/components/forms/form-field";
import { CountrySelect } from "@/components/forms/country-select";
import { StateRegionSelect } from "@/components/forms/state-region-select";

export interface CountryRegionFieldsProps {
  countryId: string;
  stateRegionId: string;
  /** ISO 3166-1 alpha-2 code, or `""` before a country is chosen. */
  countryCode: string;
  stateRegion: string;
  onCountryCodeChange: (countryCode: string) => void;
  onStateRegionChange: (stateRegion: string) => void;
  countryError?: string;
  stateRegionError?: string;
  /** Field names for native form data; not needed with React Hook Form. */
  countryName?: string;
  stateRegionName?: string;
  /** Lets the country be cleared; for forms where it is optional. */
  countryOptional?: boolean;
  /** Extra grid classes for each field. */
  className?: string;
}

/**
 * The country field and the dependent state/region field, side by side in a
 * `FormGrid`. Choosing another country clears the region, so a region of the
 * previous country is never kept.
 *
 * The region is required when the country has supported subdivisions, and
 * optional free text otherwise, matching the API.
 */
export function CountryRegionFields({
  countryId,
  stateRegionId,
  countryCode,
  stateRegion,
  onCountryCodeChange,
  onStateRegionChange,
  countryError,
  stateRegionError,
  countryName,
  stateRegionName,
  countryOptional = false,
  className,
}: CountryRegionFieldsProps) {
  const hasSubdivisions = hasCountrySubdivisions(countryCode);
  const label = getSubdivisionLabel(countryCode);
  const unmatchedSavedValue =
    hasSubdivisions &&
    stateRegion.trim() !== "" &&
    !findCountrySubdivision(countryCode, stateRegion);

  function changeCountry(next: string) {
    if (next === countryCode) return;
    onCountryCodeChange(next);
    onStateRegionChange("");
  }

  let description: string | undefined;
  if (!countryCode) {
    description = "Select a country first.";
  } else if (!hasSubdivisions) {
    description = "Enter a region if the address has one.";
  } else if (unmatchedSavedValue) {
    description = `Previously saved as “${stateRegion}”. Select the matching ${label.toLowerCase()} from the list.`;
  }

  return (
    <>
      <FormField
        id={countryId}
        label="Country"
        required={!countryOptional}
        optional={countryOptional}
        error={countryError}
        className={className}
      >
        {(control) => (
          <CountrySelect
            {...control}
            name={countryName}
            value={countryCode}
            onValueChange={changeCountry}
            required={!countryOptional}
            clearable={countryOptional}
          />
        )}
      </FormField>
      <FormField
        id={stateRegionId}
        label={label}
        // Before a country is chosen, most choices will require a region.
        required={hasSubdivisions || !countryCode}
        optional={Boolean(countryCode) && !hasSubdivisions}
        description={description}
        error={stateRegionError}
        className={className}
      >
        {(control) => (
          <StateRegionSelect
            {...control}
            name={stateRegionName}
            countryCode={countryCode}
            value={stateRegion}
            onValueChange={onStateRegionChange}
            required={hasSubdivisions}
          />
        )}
      </FormField>
    </>
  );
}
