import { allCountries } from "country-region-data";
import {
  ESubdivisionType,
  type ICountrySubdivision,
  type StateRegionValidation,
} from "./subdivision.interface.js";

/**
 * Country subdivisions for address fields, shared by the API (validation)
 * and the web app (selectors).
 *
 * Source: `country-region-data` (MIT), an offline dataset of first-level
 * subdivisions keyed by ISO 3166-1 alpha-2 country code. The adjustments
 * below correct or classify entries where ContractFlow needs more precision
 * than the dataset gives; every other country is used as published.
 */

/** Matches the `state_region` column width on companies and contract sites. */
export const STATE_REGION_MAX_LENGTH = 100;

interface CountryAdjustment {
  /** Field label for the country's subdivisions, e.g. "Province or territory". */
  label?: string;
  /** Subdivision type for codes not listed in `types`. */
  defaultType?: ESubdivisionType;
  types?: Record<string, ESubdivisionType>;
  /** Codes to drop: entries the dataset lists that are not subdivisions. */
  exclude?: readonly string[];
  /** Display-name corrections by code. */
  names?: Record<string, string>;
  /** Other spellings people use, matched when reading saved values. */
  aliases?: Record<string, readonly string[]>;
}

const ADJUSTMENTS: Record<string, CountryAdjustment> = {
  // 36 states and the Federal Capital Territory, which is not a state.
  NG: {
    label: "State",
    defaultType: ESubdivisionType.STATE,
    types: { FC: ESubdivisionType.FEDERAL_CAPITAL_TERRITORY },
    names: { FC: "Federal Capital Territory" },
    aliases: { FC: ["Abuja Federal Capital Territory", "FCT", "Abuja"] },
  },
  // 50 states and the District of Columbia. The dataset also lists postal
  // codes for territories and freely associated states, which have their own
  // ISO country codes, and for armed forces mail.
  US: {
    label: "State",
    defaultType: ESubdivisionType.STATE,
    types: { DC: ESubdivisionType.FEDERAL_DISTRICT },
    exclude: ["AS", "GU", "MP", "PR", "VI", "FM", "MH", "PW", "AA", "AE", "AP"],
  },
  CA: {
    label: "Province or territory",
    defaultType: ESubdivisionType.PROVINCE,
    types: {
      NT: ESubdivisionType.TERRITORY,
      NU: ESubdivisionType.TERRITORY,
      YT: ESubdivisionType.TERRITORY,
    },
  },
  AU: {
    label: "State or territory",
    defaultType: ESubdivisionType.STATE,
    types: { ACT: ESubdivisionType.TERRITORY, NT: ESubdivisionType.TERRITORY },
  },
  GH: { label: "Region", defaultType: ESubdivisionType.REGION },
  KE: { label: "County", defaultType: ESubdivisionType.COUNTY },
  ZA: { label: "Province", defaultType: ESubdivisionType.PROVINCE },
  GB: { label: "County or council area" },
};

export const DEFAULT_SUBDIVISION_LABEL = "State or region";

/** Lower-cases, strips accents and punctuation, and collapses spaces. */
export function normalizeGeographyText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Words people add to a subdivision's name, as in "Lagos State". */
const DESCRIPTOR_SUFFIX = / (state|province|region|county|territory)$/;

interface CountryIndex {
  subdivisions: readonly ICountrySubdivision[];
  lookup: Map<string, ICountrySubdivision>;
}

let indexByCountry: Map<string, CountryIndex> | null = null;

function cleanCode(code: string | undefined): string | null {
  // The ESM build writes a missing code as the string "undefined".
  return code && code !== "undefined" ? code : null;
}

function buildIndex(): Map<string, CountryIndex> {
  const result = new Map<string, CountryIndex>();
  for (const [, countryCode, regions] of allCountries) {
    const adjustment = ADJUSTMENTS[countryCode] ?? {};
    const excluded = new Set(adjustment.exclude ?? []);
    // A single entry is the territory itself (Gibraltar, Hong Kong, ...),
    // not a subdivision: such countries are treated as having none.
    if (regions.length < 2) continue;

    const subdivisions: ICountrySubdivision[] = [];
    const lookup = new Map<string, ICountrySubdivision>();
    for (const [regionName, regionCode] of regions) {
      const code = cleanCode(regionCode);
      if (code && excluded.has(code)) continue;
      const subdivision: ICountrySubdivision = Object.freeze({
        countryCode,
        code,
        name: (code && adjustment.names?.[code]) || regionName,
        type:
          (code && adjustment.types?.[code]) || adjustment.defaultType || null,
      });
      subdivisions.push(subdivision);
      const keys = [subdivision.name, regionName];
      if (code) keys.push(code, `${countryCode}-${code}`);
      if (code) keys.push(...(adjustment.aliases?.[code] ?? []));
      for (const key of keys) {
        const normalized = normalizeGeographyText(key);
        if (normalized && !lookup.has(normalized)) {
          lookup.set(normalized, subdivision);
        }
      }
    }
    subdivisions.sort((a, b) => a.name.localeCompare(b.name, "en"));
    result.set(countryCode, {
      subdivisions: Object.freeze(subdivisions),
      lookup,
    });
  }
  return result;
}

function countryIndex(countryCode: string | null | undefined) {
  if (!countryCode) return undefined;
  indexByCountry ??= buildIndex();
  return indexByCountry.get(countryCode.trim().toUpperCase());
}

const NONE: readonly ICountrySubdivision[] = Object.freeze([]);

/** The country's subdivisions sorted by name; empty when none are supported. */
export function getCountrySubdivisions(
  countryCode: string | null | undefined,
): readonly ICountrySubdivision[] {
  return countryIndex(countryCode)?.subdivisions ?? NONE;
}

export function hasCountrySubdivisions(
  countryCode: string | null | undefined,
): boolean {
  return getCountrySubdivisions(countryCode).length > 0;
}

/** The field label for a country's subdivisions, e.g. "State" for Nigeria. */
export function getSubdivisionLabel(
  countryCode: string | null | undefined,
): string {
  const code = countryCode?.trim().toUpperCase();
  return (code && ADJUSTMENTS[code]?.label) || DEFAULT_SUBDIVISION_LABEL;
}

/**
 * Finds the subdivision of `countryCode` that `value` names: its name, code
 * (`LA` or `NG-LA`), or a known alternative spelling, ignoring case and
 * accents. A trailing descriptor is tolerated, so "Lagos State" finds Lagos.
 * Never returns a subdivision of another country.
 */
export function findCountrySubdivision(
  countryCode: string | null | undefined,
  value: string | null | undefined,
): ICountrySubdivision | null {
  const index = countryIndex(countryCode);
  if (!index || !value) return null;
  const normalized = normalizeGeographyText(value);
  if (!normalized) return null;
  return (
    index.lookup.get(normalized) ??
    index.lookup.get(normalized.replace(DESCRIPTOR_SUFFIX, "")) ??
    null
  );
}

/**
 * Checks a `stateRegion` value for a country and returns the value to store.
 *
 * - A country with supported subdivisions requires one of them; the stored
 *   value is its canonical name.
 * - Any other country accepts optional free text (blank allowed), so no one
 *   is made to pick a subdivision that does not exist.
 */
export function validateStateRegion(
  countryCode: string | null | undefined,
  value: string | null | undefined,
): StateRegionValidation {
  const text = (value ?? "").trim();
  if (!hasCountrySubdivisions(countryCode)) {
    if (text.length > STATE_REGION_MAX_LENGTH) {
      return {
        valid: false,
        reason: "too_long",
        message: `Use ${STATE_REGION_MAX_LENGTH} characters or fewer.`,
      };
    }
    return { valid: true, value: text, subdivision: null };
  }

  const label = getSubdivisionLabel(countryCode).toLowerCase();
  if (!text) {
    return { valid: false, reason: "required", message: `Select a ${label}.` };
  }
  const subdivision = findCountrySubdivision(countryCode, text);
  if (!subdivision) {
    return {
      valid: false,
      reason: "unknown",
      message: `Select a ${label} of the selected country.`,
    };
  }
  return { valid: true, value: subdivision.name, subdivision };
}
