import type { IntegerString } from "../interfaces/workspace-values.interface.js";

/**
 * A monetary amount in whole minor units of its currency (kobo, cents; yen
 * have none, dinars have thousandths), written as a decimal integer string:
 * `"250000000"` is NGN 2,500,000.00. This is the API format for every
 * monetary `*Minor` field, in requests and responses alike.
 *
 * - The database stores amounts as PostgreSQL `bigint`, which a JSON number
 *   cannot always hold exactly, so amounts never travel as numbers.
 * - An amount always travels with the currency code of its record.
 * - Calculate with `BigInt` (`minorAmountToBigInt`), never with `Number`,
 *   and turn results back into strings (`toMinorAmount`).
 *
 * Rates (`*Bps`), exchange rates (`*Micro`) and quantities (`*Milli`) are not
 * amounts of money and keep their own formats.
 */
export type MinorAmount = IntegerString;

/** The smallest value a PostgreSQL `bigint` column holds. */
export const MINOR_AMOUNT_MIN: MinorAmount = "-9223372036854775808";

/** The largest value a PostgreSQL `bigint` column holds. */
export const MINOR_AMOUNT_MAX: MinorAmount = "9223372036854775807";

/**
 * Digits only, in canonical form: an optional minus sign, then no leading
 * zeros, and no `-0`. The API writes amounts this way, so it accepts them
 * only this way rather than silently rewriting what a client sent.
 */
const MINOR_AMOUNT_PATTERN = /^(?:0|-?[1-9]\d*)$/;

/**
 * Which amounts a field accepts. Fields differ: a contract value can be zero
 * but not negative, while a variation's change in value can be negative.
 */
export type MinorAmountSign = "any" | "non-negative" | "positive";

export type MinorAmountInvalidReason =
  "not_string" | "format" | "out_of_range" | "negative" | "not_positive";

export type MinorAmountValidation =
  | { valid: true; amount: bigint }
  | { valid: false; reason: MinorAmountInvalidReason; message: string };

const SIGN_MESSAGES: Record<
  Exclude<MinorAmountSign, "any">,
  { reason: MinorAmountInvalidReason; message: string }
> = {
  "non-negative": {
    reason: "negative",
    message: "must be zero or more.",
  },
  positive: {
    reason: "not_positive",
    message: "must be more than zero.",
  },
};

/**
 * Checks that `value` is a `MinorAmount` within the `bigint` range and the
 * field's `sign` rule. Numbers are rejected, never converted: a JSON number
 * may already have lost digits, and a decimal one is not a whole minor unit.
 */
export function validateMinorAmount(
  value: unknown,
  { sign = "any" }: { sign?: MinorAmountSign } = {},
): MinorAmountValidation {
  if (typeof value !== "string") {
    return {
      valid: false,
      reason: "not_string",
      message:
        'must be a whole number of minor units sent as a string, such as "250000".',
    };
  }
  if (!MINOR_AMOUNT_PATTERN.test(value)) {
    return {
      valid: false,
      reason: "format",
      message:
        "must contain only digits, with an optional leading minus sign and no leading zeros, decimals or spaces.",
    };
  }
  const amount = BigInt(value);
  if (amount < BigInt(MINOR_AMOUNT_MIN) || amount > BigInt(MINOR_AMOUNT_MAX)) {
    return {
      valid: false,
      reason: "out_of_range",
      message: `must be between ${MINOR_AMOUNT_MIN} and ${MINOR_AMOUNT_MAX}.`,
    };
  }
  if (sign === "non-negative" && amount < BigInt(0)) {
    return { valid: false, ...SIGN_MESSAGES[sign] };
  }
  if (sign === "positive" && amount <= BigInt(0)) {
    return { valid: false, ...SIGN_MESSAGES[sign] };
  }
  return { valid: true, amount };
}

/** Whether `value` is a valid `MinorAmount` for a field with this sign rule. */
export function isMinorAmount(
  value: unknown,
  options: { sign?: MinorAmountSign } = {},
): value is MinorAmount {
  return validateMinorAmount(value, options).valid;
}

/**
 * The exact value of an amount, for calculations. Throws when `value` is not a
 * valid `MinorAmount`, so a malformed amount can't turn into a wrong total.
 */
export function minorAmountToBigInt(value: MinorAmount): bigint {
  const result = validateMinorAmount(value);
  if (!result.valid) {
    throw new RangeError(`Amount "${value}" ${result.message}`);
  }
  return result.amount;
}

/**
 * The `MinorAmount` for a calculated value. Throws when it no longer fits a
 * `bigint` column, rather than storing a different amount.
 */
export function toMinorAmount(amount: bigint): MinorAmount {
  const text = amount.toString();
  const result = validateMinorAmount(text);
  if (!result.valid) {
    throw new RangeError(`Amount ${text} ${result.message}`);
  }
  return text;
}
