import type { z } from "zod";
import {
  findCountrySubdivision,
  validateStateRegion,
} from "@contractflow/contracts-schema/geography";

/**
 * Zod refinement for forms with `countryCode` and `stateRegion` fields: the
 * region must be a subdivision of the selected country where ContractFlow
 * supports them, and is optional text elsewhere. The API applies the same
 * rule, so this only gives earlier feedback.
 */
export function refineStateRegion(
  values: { countryCode: string; stateRegion: string },
  ctx: z.RefinementCtx,
) {
  // Without a country the country field shows the error.
  if (!values.countryCode) return;
  const result = validateStateRegion(values.countryCode, values.stateRegion);
  if (!result.valid) {
    ctx.addIssue({
      code: "custom",
      path: ["stateRegion"],
      message: result.message,
    });
  }
}

/** Returns the region's error message, or `undefined` when it is valid. */
export function stateRegionError(
  countryCode: string,
  stateRegion: string,
): string | undefined {
  if (!countryCode) return undefined;
  const result = validateStateRegion(countryCode, stateRegion);
  return result.valid ? undefined : result.message;
}

/**
 * Maps a saved region to the canonical subdivision name when it matches one
 * (so "Lagos State" shows as Lagos), and otherwise returns it unchanged.
 */
export function normalizeStateRegion(
  countryCode: string,
  stateRegion: string,
): string {
  return findCountrySubdivision(countryCode, stateRegion)?.name ?? stateRegion;
}
