import { ECountryCode } from "@contractflow/contracts-schema";

export const countryCodes = Object.values(ECountryCode) as [
  ECountryCode,
  ...ECountryCode[],
];

const displayNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

export function countryName(code: string): string {
  try {
    return displayNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

export const countryOptions = countryCodes
  .map((code) => ({ code, name: countryName(code) }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));
