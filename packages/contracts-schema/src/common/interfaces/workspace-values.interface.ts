/**
 * Value formats used by contract workspace read responses (delivery,
 * financial, HSE, site operations and compliance).
 */

/**
 * A whole number stored as a 64-bit integer, as a decimal string, because a
 * JSON number cannot always hold it exactly: thousandths of a unit of measure
 * (`*Milli`) or millionths of an exchange rate (`*Micro`). Money uses
 * `MinorAmount`, the same format named for amounts of money.
 */
export type IntegerString = string;

/** A calendar date with no time or zone, `YYYY-MM-DD`. */
export type DateOnlyString = string;

/** An instant as an ISO 8601 UTC timestamp. */
export type TimestampString = string;
