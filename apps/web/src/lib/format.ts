/**
 * Shared display formatting for dates, times, money, and numbers.
 *
 * Every screen formats values through these helpers so the same value reads
 * the same everywhere. Locale defaults to the viewer's browser locale; pass
 * `locale` only where a fixed locale is required (for example, in tests).
 */

/** Shown wherever a value is missing or cannot be read. */
export const EMPTY_VALUE = "—";

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;
const DAY_MS = 86_400_000;

export interface FormatOptions {
  /** BCP 47 locale. Omit to use the viewer's locale. */
  locale?: string;
  /** Text returned for a missing or invalid value. */
  fallback?: string;
}

export interface DateTimeFormatOptions extends FormatOptions {
  /** IANA time zone, such as the user's configured timezone. */
  timeZone?: string;
}

/** Returns the time zone if the runtime supports it, otherwise undefined. */
export function resolveTimeZone(timeZone?: string | null): string | undefined {
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}

function toInstant(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a calendar date such as a contract start or end date.
 *
 * The API sends these as `YYYY-MM-DD` (sometimes with a midnight UTC time).
 * They name a day, not an instant, so they are formatted in UTC and never
 * shift to the previous or next day in the viewer's time zone.
 */
export function formatCalendarDate(
  value: string | null | undefined,
  { locale, fallback = EMPTY_VALUE }: FormatOptions = {},
): string {
  if (!value) return fallback;
  const match = CALENDAR_DATE.exec(value);
  if (!match) return fallback;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  // Rejects impossible dates such as 2026-02-31, which Date.UTC rolls over.
  if (date.getUTCDate() !== Number(day)) return fallback;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

/** Formats the day on which an instant (a timestamp) occurred. */
export function formatDate(
  value: string | Date | null | undefined,
  { locale, timeZone, fallback = EMPTY_VALUE }: DateTimeFormatOptions = {},
): string {
  const date = toInstant(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: resolveTimeZone(timeZone),
  }).format(date);
}

/** Formats an instant with its date and time, such as an activity entry. */
export function formatDateTime(
  value: string | Date | null | undefined,
  { locale, timeZone, fallback = EMPTY_VALUE }: DateTimeFormatOptions = {},
): string {
  const date = toInstant(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: resolveTimeZone(timeZone),
  }).format(date);
}

/** Formats only the time of an instant, such as "last updated at". */
export function formatTime(
  value: string | Date | null | undefined,
  { locale, timeZone, fallback = EMPTY_VALUE }: DateTimeFormatOptions = {},
): string {
  const date = toInstant(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(locale, {
    timeStyle: "short",
    timeZone: resolveTimeZone(timeZone),
  }).format(date);
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * DAY_MS],
  ["month", 30 * DAY_MS],
  ["week", 7 * DAY_MS],
  ["day", DAY_MS],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** Formats an instant relative to now, such as "3 hours ago". */
export function formatRelativeTime(
  value: string | Date | null | undefined,
  {
    locale,
    fallback = EMPTY_VALUE,
    now = new Date(),
  }: FormatOptions & { now?: Date } = {},
): string {
  const date = toInstant(value);
  if (!date) return fallback;
  const elapsed = date.getTime() - now.getTime();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(elapsed) >= size) {
      return formatter.format(Math.round(elapsed / size), unit);
    }
  }
  return formatter.format(0, "minute");
}

/**
 * Whole days from today until a calendar date, counted in UTC as calendar
 * dates are. Returns null for a missing or invalid date.
 */
export function daysUntilCalendarDate(
  value: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!value) return null;
  const match = CALENDAR_DATE.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const target = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.round((target - today) / DAY_MS);
}

/**
 * Today's date as `YYYY-MM-DD` in the viewer's local calendar, for the `max`
 * or default of a date input. `toISOString()` would give the UTC date, which
 * is a day off near midnight.
 */
export function todayAsCalendarDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The number of decimal places a currency uses for its minor unit (2 for NGN
 * and USD, 0 for JPY, 3 for KWD), or null for an unknown currency code.
 */
export function currencyDigits(currencyCode: string): number | null {
  try {
    return (
      new Intl.NumberFormat("en", {
        style: "currency",
        currency: currencyCode,
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return null;
  }
}

/** Converts an integer amount of minor units to an exact decimal string. */
function minorToDecimal(
  amountMinor: number | string | bigint,
  digits: number,
): string | null {
  let minor: bigint;
  try {
    if (typeof amountMinor === "number") {
      if (!Number.isSafeInteger(amountMinor)) return null;
      minor = BigInt(amountMinor);
    } else if (typeof amountMinor === "bigint") {
      minor = amountMinor;
    } else {
      const trimmed = amountMinor.trim();
      if (!/^-?\d+$/.test(trimmed)) return null;
      minor = BigInt(trimmed);
    }
  } catch {
    return null;
  }
  const negative = minor < BigInt(0);
  const digitsText = (negative ? -minor : minor)
    .toString()
    .padStart(digits + 1, "0");
  const whole = digitsText.slice(0, digitsText.length - digits);
  const fraction = digits ? `.${digitsText.slice(-digits)}` : "";
  return `${negative ? "-" : ""}${whole}${fraction}`;
}

/**
 * Formats an amount stored in minor units (for example kobo or cents) in its
 * own currency. The currency's minor-unit precision comes from Intl, so JPY
 * has no decimals and KWD has three. Large amounts stay exact: they are
 * formatted from a decimal string, never through floating point.
 */
export function formatMoneyMinor(
  amountMinor: number | string | bigint | null | undefined,
  currencyCode: string | null | undefined,
  { locale, fallback = EMPTY_VALUE }: FormatOptions = {},
): string {
  if (amountMinor === null || amountMinor === undefined || !currencyCode) {
    return fallback;
  }
  const digits = currencyDigits(currencyCode);
  if (digits === null) return fallback;
  const decimal = minorToDecimal(amountMinor, digits);
  if (decimal === null) return fallback;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    // Intl formats numeric strings exactly; the cast covers older TS libs.
  }).format(decimal as unknown as number);
}

/** A plain decimal number as typed: digits, then optionally "." and digits. */
const DECIMAL_TEXT = /^(\d+)(?:\.(\d+))?$/;

/**
 * Converts a typed decimal amount ("1500000.50", "1,500,000.50") to whole
 * minor units of the currency (150000050 for NGN). Exact: it works on the
 * digits, never through floating point. Returns null when the text is not a
 * non-negative amount, has more decimals than the currency allows, or is too
 * large to send as a safe integer.
 */
export function parseDecimalToMinor(
  text: string,
  currencyCode: string,
): number | null {
  const digits = currencyDigits(currencyCode);
  if (digits === null) return null;
  // Grouping commas are allowed only in their usual places.
  const trimmed = text.trim();
  const compact = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmed)
    ? trimmed.replaceAll(",", "")
    : trimmed;
  const match = DECIMAL_TEXT.exec(compact);
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  if (fraction.length > digits) return null;
  const minor = BigInt(whole + fraction.padEnd(digits, "0"));
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(minor);
}

/**
 * Converts a typed percentage ("5", "2.5", "12.25") to basis points (500,
 * 250, 1225). Returns null unless it is between 0 and 100 with at most two
 * decimal places, the precision basis points can hold.
 */
export function parsePercentToBasisPoints(text: string): number | null {
  const match = DECIMAL_TEXT.exec(text.trim());
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  if (fraction.length > 2 || whole.length > 3) return null;
  const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return basisPoints <= 10_000 ? basisPoints : null;
}

/** Formats a count or quantity with locale grouping. */
export function formatNumber(
  value: number | null | undefined,
  {
    locale,
    fallback = EMPTY_VALUE,
    maximumFractionDigits = 2,
  }: FormatOptions & { maximumFractionDigits?: number } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

/** Formats a file size in bytes: "12 bytes", "640 KB", "2.4 MB". */
export function formatFileSize(
  bytes: number | null | undefined,
  { locale, fallback = EMPTY_VALUE }: FormatOptions = {},
): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return fallback;
  }
  if (bytes < 1024) return `${formatNumber(bytes, { locale })} bytes`;
  if (bytes < 1024 * 1024) {
    return `${formatNumber(Math.round(bytes / 1024), { locale })} KB`;
  }
  return `${formatNumber(bytes / (1024 * 1024), { locale, maximumFractionDigits: 1 })} MB`;
}

/** Formats a ratio as a percentage: 0.25 becomes "25%". */
export function formatPercent(
  ratio: number | null | undefined,
  {
    locale,
    fallback = EMPTY_VALUE,
    maximumFractionDigits = 0,
  }: FormatOptions & { maximumFractionDigits?: number } = {},
): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) {
    return fallback;
  }
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits,
  }).format(ratio);
}

/** Formats basis points as a percentage: 500 bps becomes "5%". */
export function formatBasisPoints(
  basisPoints: number | null | undefined,
  options: FormatOptions = {},
): string {
  if (
    basisPoints === null ||
    basisPoints === undefined ||
    !Number.isFinite(basisPoints)
  ) {
    return options.fallback ?? EMPTY_VALUE;
  }
  return formatPercent(basisPoints / 10_000, {
    ...options,
    maximumFractionDigits: 2,
  });
}

/**
 * Turns an API enum value such as `under_review` or `contract.deleted` into
 * readable text ("Under review", "Contract deleted"). Values that are already
 * readable are returned as is.
 */
export function humanizeEnumValue(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE;
  if (!/[_.-]/.test(value) && value !== value.toLowerCase()) return value;
  const words = value
    .trim()
    .split(/[_.\s-]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase())
    .map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Enum words that read as acronyms, such as the EPC contract type. */
const ACRONYMS = new Set(["epc", "hse", "id", "url"]);
