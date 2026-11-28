/**
 * A ContractFlow record identifier: a ULID, 26 Crockford base-32 characters.
 * The first character is at most 7, because a ULID is 128 bits. Lower case is
 * accepted, as the API always has; ids are generated in upper case.
 */
export const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i;

/** Whether `value` is a ULID record identifier. */
export function isUlid(value: unknown): value is string {
  return typeof value === "string" && ULID_PATTERN.test(value);
}
