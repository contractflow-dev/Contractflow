import {
  AsYouType,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js/max";

/**
 * Phone numbers shared by the API (validation and normalisation) and the web
 * app (the phone field).
 *
 * Numbers are stored in E.164 (`+2348031234567`). Forms keep the country
 * (ISO 3166-1 alpha-2) and the national number apart and only combine them
 * through `validatePhoneNumber`, which applies the country's numbering rules,
 * including its trunk prefix: `0803 123 4567` in Nigeria is `+2348031234567`.
 *
 * Source: `libphonenumber-js` (MIT) with its full ("max") metadata, so each
 * country's number patterns are checked, not only their lengths.
 */

/** Matches the `phone_number` column width on users and companies. */
export const PHONE_NUMBER_MAX_LENGTH = 20;

/** Characters people type in phone numbers besides digits. */
const ALLOWED_CHARACTERS = /^[\d\s().+\-]*$/;

export type PhoneNumberInvalidReason =
  | "required"
  | "country_required"
  | "unsupported_country"
  | "invalid_characters"
  | "too_short"
  | "too_long"
  | "other_country"
  | "invalid";

export type PhoneNumberValidation =
  | {
      valid: true;
      /** The number to store, in E.164. */
      e164: string;
      /** The number's country; can differ only when an international number was typed. */
      countryCode: string;
    }
  | { valid: false; reason: PhoneNumberInvalidReason; message: string };

function supportedCountry(
  countryCode: string | null | undefined,
): CountryCode | null {
  const code = countryCode?.trim().toUpperCase();
  return code && isSupportedCountry(code) ? code : null;
}

/** Whether ContractFlow can validate numbers for the country. */
export function isPhoneCountrySupported(
  countryCode: string | null | undefined,
): boolean {
  return supportedCountry(countryCode) !== null;
}

/** The country's international calling code without `+` (`"234"`), or `null`. */
export function getPhoneCallingCode(
  countryCode: string | null | undefined,
): string | null {
  const code = supportedCountry(countryCode);
  return code ? getCountryCallingCode(code) : null;
}

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function countryLabel(code: string): string {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

function invalid(
  reason: PhoneNumberInvalidReason,
  message: string,
): PhoneNumberValidation {
  return { valid: false, reason, message };
}

/**
 * Checks a national number against the selected country and returns it in
 * E.164. An international number (`+44 …` or `0044 …`) typed into the field
 * is accepted when it belongs to the selected country.
 *
 * An empty number is reported as `required`; forms where the number is
 * optional skip validation when it is empty.
 */
export function validatePhoneNumber(
  countryCode: string | null | undefined,
  nationalNumber: string | null | undefined,
): PhoneNumberValidation {
  const text = (nationalNumber ?? "").trim();
  if (!text) return invalid("required", "Enter a phone number.");
  if (!countryCode?.trim()) {
    return invalid("country_required", "Select the country for this number.");
  }
  const country = supportedCountry(countryCode);
  if (!country) {
    return invalid(
      "unsupported_country",
      "Phone numbers for this country can't be checked. Select another country.",
    );
  }
  if (!ALLOWED_CHARACTERS.test(text)) {
    return invalid(
      "invalid_characters",
      "Use digits only. Spaces, brackets and dashes are fine.",
    );
  }

  const name = countryLabel(country);
  // "00" is the international prefix in most countries.
  const input = text.startsWith("00") ? `+${text.slice(2)}` : text;
  const length = validatePhoneNumberLength(input, country);
  if (length === "TOO_SHORT" || length === "NOT_A_NUMBER") {
    return invalid("too_short", `This number is too short for ${name}.`);
  }
  if (length === "TOO_LONG") {
    return invalid("too_long", `This number is too long for ${name}.`);
  }

  const phone = parsePhoneNumberFromString(input, country);
  if (!phone) return invalid("invalid", `Enter a valid ${name} number.`);
  // Countries that share a calling code (+1, +44, +7) each have their own
  // numbering ranges: a US number is not a valid Canadian one.
  if (phone.country && phone.country !== country) {
    return invalid(
      "other_country",
      `This is a ${countryLabel(phone.country)} number. Select that country or check the number.`,
    );
  }
  if (
    !phone.country &&
    phone.countryCallingCode !== getCountryCallingCode(country)
  ) {
    return invalid(
      "other_country",
      `This number doesn't belong to ${name}. Select its country or remove the country code.`,
    );
  }
  if (!phone.isValid()) {
    return invalid("invalid", `Enter a valid ${name} number.`);
  }
  return { valid: true, e164: phone.number, countryCode: country };
}

/**
 * Checks an international number such as `+234 803 123 4567`, as the API
 * receives it, and returns it in E.164. Numbers without a leading `+` are
 * invalid: without a country their trunk prefix cannot be interpreted.
 */
export function validateInternationalPhoneNumber(
  value: string | null | undefined,
): PhoneNumberValidation {
  const text = (value ?? "").trim();
  if (!text) return invalid("required", "Enter a phone number.");
  if (!text.startsWith("+")) {
    return invalid(
      "country_required",
      "Include the country calling code, for example +234 803 123 4567.",
    );
  }
  const phone = ALLOWED_CHARACTERS.test(text)
    ? parsePhoneNumberFromString(text)
    : undefined;
  if (!phone?.isValid()) {
    return invalid("invalid", "Enter a valid international phone number.");
  }
  return { valid: true, e164: phone.number, countryCode: phone.country ?? "" };
}

export interface PhoneNumberParts {
  /** ISO 3166-1 alpha-2 code, or `""` when it could not be determined. */
  countryCode: string;
  /** The number without its calling code, formatted for the country. */
  nationalNumber: string;
  /**
   * `false` when the saved value could not be read as a valid number; the
   * whole value is then returned as `nationalNumber` for the user to fix.
   */
  recognized: boolean;
}

/**
 * Splits a saved number into the phone field's country and national number.
 *
 * Numbers saved before validation may lack a calling code: those are read in
 * `fallbackCountry` (for a company, its address country). A value that still
 * isn't a valid number is returned unchanged so it is never silently lost.
 */
export function splitPhoneNumber(
  value: string | null | undefined,
  fallbackCountry?: string | null,
): PhoneNumberParts {
  const text = (value ?? "").trim();
  const fallback = supportedCountry(fallbackCountry) ?? "";
  if (!text)
    return { countryCode: fallback, nationalNumber: "", recognized: true };

  const international = text.startsWith("00") ? `+${text.slice(2)}` : text;
  const phone = ALLOWED_CHARACTERS.test(text)
    ? international.startsWith("+")
      ? parsePhoneNumberFromString(international)
      : fallback
        ? parsePhoneNumberFromString(text, fallback)
        : undefined
    : undefined;

  if (phone?.isValid() && phone.country) {
    return {
      countryCode: phone.country,
      nationalNumber: formatNationalNumber(phone.country, phone.nationalNumber),
      recognized: true,
    };
  }
  return { countryCode: fallback, nationalNumber: text, recognized: false };
}

/**
 * Groups a national number's digits as the country writes them, without the
 * trunk prefix (`8031234567` in Nigeria is `803 123 4567`).
 */
export function formatNationalNumber(
  countryCode: string,
  nationalNumber: string,
): string {
  const country = supportedCountry(countryCode);
  if (!country) return nationalNumber;
  const callingCode = getCountryCallingCode(country);
  const formatted = new AsYouType(country).input(
    `+${callingCode}${nationalNumber}`,
  );
  return (
    formatted.replace(new RegExp(`^\\+${callingCode}\\s*`), "") ||
    nationalNumber
  );
}
