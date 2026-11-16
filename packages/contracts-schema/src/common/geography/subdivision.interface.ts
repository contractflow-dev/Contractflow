/**
 * How a first-level subdivision is classified. Only set where ContractFlow
 * records the classification for a country; otherwise a subdivision's type
 * is `null` and the UI uses the country's generic subdivision label.
 */
export enum ESubdivisionType {
  STATE = "state",
  PROVINCE = "province",
  TERRITORY = "territory",
  REGION = "region",
  COUNTY = "county",
  FEDERAL_DISTRICT = "federal_district",
  FEDERAL_CAPITAL_TERRITORY = "federal_capital_territory",
}

/** A first-level administrative subdivision of a country. */
export interface ICountrySubdivision {
  /** ISO 3166-1 alpha-2 code of the country the subdivision belongs to. */
  countryCode: string;
  /**
   * The subdivision's short code (the ISO 3166-2 suffix for most countries,
   * e.g. `LA` for Lagos, `FC` for the Federal Capital Territory), or `null`
   * where the dataset has none.
   */
  code: string | null;
  /** Display name; this is the value stored in `stateRegion`. */
  name: string;
  type: ESubdivisionType | null;
}

/** Result of checking a `stateRegion` value against a country. */
export type StateRegionValidation =
  | {
      valid: true;
      /** The value to store: the canonical subdivision name, or trimmed free text. */
      value: string;
      subdivision: ICountrySubdivision | null;
    }
  | {
      valid: false;
      /** `required`: the country has subdivisions and none was given. */
      reason: "required" | "unknown" | "too_long";
      message: string;
    };
