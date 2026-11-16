/**
 * Formats database values for API responses, following the value formats in
 * `@contractflow/contracts-schema` (`TimestampString`, `DateOnlyString`,
 * `IntegerString`).
 *
 * The node-postgres driver returns `date` columns as `YYYY-MM-DD` strings and
 * `bigint` columns as decimal strings, whatever the entity property type
 * says, so each helper accepts both forms.
 */

/** An instant as an ISO 8601 UTC timestamp. */
export function toTimestamp(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

export function toNullableTimestamp(
  value: Date | string | null | undefined,
): string | null {
  return value === null || value === undefined || value === ''
    ? null
    : toTimestamp(value);
}

/** A calendar date, `YYYY-MM-DD`. */
export function toDateOnly(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value.slice(0, 10);
}

export function toNullableDateOnly(
  value: Date | string | null | undefined,
): string | null {
  return value === null || value === undefined || value === ''
    ? null
    : toDateOnly(value);
}

/** A whole number as a decimal string, without losing 64-bit precision. */
export function toIntegerString(value: number | string | bigint): string {
  const text = String(value).trim();
  if (!/^-?\d+$/.test(text)) {
    throw new Error(`Expected a whole number, received "${text}".`);
  }
  return BigInt(text).toString();
}

export function toNullableIntegerString(
  value: number | string | bigint | null | undefined,
): string | null {
  return value === null || value === undefined || value === ''
    ? null
    : toIntegerString(value);
}

/**
 * Text or an identifier that is only set at a later stage (a decision, a
 * verification): `null` until it has a value. Empty strings count as unset.
 */
export function toNullableText(
  value: string | null | undefined,
): string | null {
  return value === null || value === undefined || value === '' ? null : value;
}

/** A value whose column may be unset, such as an optional enum. */
export function toNullable<T>(value: T | null | undefined | ''): T | null {
  return value === null || value === undefined || value === '' ? null : value;
}
