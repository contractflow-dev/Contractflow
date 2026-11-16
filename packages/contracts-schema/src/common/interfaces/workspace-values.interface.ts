/**
 * Value formats used by contract workspace read responses (delivery,
 * financial, HSE, site operations and compliance).
 */

/**
 * A whole number of minor currency units (kobo, cents) or thousandths of a
 * unit of measure, as a decimal string: the database stores these as 64-bit
 * integers, which a JSON number cannot always hold exactly.
 */
export type IntegerString = string;

/** A calendar date with no time or zone, `YYYY-MM-DD`. */
export type DateOnlyString = string;

/** An instant as an ISO 8601 UTC timestamp. */
export type TimestampString = string;
