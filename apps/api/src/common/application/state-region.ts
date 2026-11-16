import { BadRequestException } from '@nestjs/common';
import { validateStateRegion } from '@contractflow/contracts-schema/geography';

/**
 * Returns the `stateRegion` to store for an address in `countryCode`.
 *
 * Where ContractFlow supports the country's subdivisions, the value must name
 * one of them (by name or code) and is stored as its canonical name, so a
 * state can never belong to another country. Elsewhere it is optional text.
 */
export function resolveStateRegion(
  countryCode: string,
  stateRegion: string | null | undefined,
): string {
  const result = validateStateRegion(countryCode, stateRegion);
  if (!result.valid) {
    throw new BadRequestException(result.message);
  }
  return result.value;
}

/**
 * Applies `resolveStateRegion` to a partial address update.
 *
 * Only an update that sends the country or the state/region is checked, and
 * then against the combination that will be saved. A record saved before
 * subdivisions were validated keeps its free-text value until one of the two
 * fields is edited, so unrelated edits are never blocked by it.
 *
 * Returns the `stateRegion` to store, or `undefined` when neither was sent.
 */
export function resolveStateRegionUpdate(
  current: { countryCode: string; stateRegion: string },
  update: { countryCode?: string; stateRegion?: string },
): string | undefined {
  if (update.countryCode === undefined && update.stateRegion === undefined) {
    return undefined;
  }
  return resolveStateRegion(
    update.countryCode ?? current.countryCode,
    update.stateRegion ?? current.stateRegion,
  );
}
