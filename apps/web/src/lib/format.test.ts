import { describe, expect, it } from "vitest";
import type { MinorAmount } from "@contractflow/contracts-schema/money";
import {
  EMPTY_VALUE,
  currencyDigits,
  dayBoundsInTimeZone,
  daysUntilCalendarDate,
  formatBasisPoints,
  formatCalendarDate,
  formatDate,
  formatDateTime,
  formatFileSize,
  formatMoneyMinor,
  groupDecimalInput,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatTime,
  humanizeEnumValue,
  parseDecimalToMinor,
  parsePercentToBasisPoints,
  resolveTimeZone,
  todayAsCalendarDate,
} from "./format";

const locale = "en-US";

/** Intl separates a currency code from the amount with a no-break space. */
const spaced = (text: string) => text.replace(/\s/g, " ");

describe("formatCalendarDate", () => {
  it("formats a date-only value without shifting the day", () => {
    expect(formatCalendarDate("2026-01-15", { locale })).toBe("Jan 15, 2026");
  });

  it("keeps the calendar day when the API adds a midnight UTC time", () => {
    expect(formatCalendarDate("2026-12-31T00:00:00.000Z", { locale })).toBe(
      "Dec 31, 2026",
    );
  });

  it("is unaffected by the viewer's time zone", () => {
    const previous = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      expect(formatCalendarDate("2026-03-01", { locale })).toBe("Mar 1, 2026");
    } finally {
      process.env.TZ = previous;
    }
  });

  it("returns the fallback for missing, malformed, or impossible dates", () => {
    expect(formatCalendarDate(null)).toBe(EMPTY_VALUE);
    expect(formatCalendarDate("")).toBe(EMPTY_VALUE);
    expect(formatCalendarDate("15/01/2026")).toBe(EMPTY_VALUE);
    expect(formatCalendarDate("2026-02-31")).toBe(EMPTY_VALUE);
    expect(formatCalendarDate(undefined, { fallback: "Not set" })).toBe(
      "Not set",
    );
  });
});

describe("instant formatting", () => {
  // 23:30 UTC on 31 Dec is already 1 Jan in Lagos (UTC+1).
  const instant = "2026-12-31T23:30:00.000Z";

  it("formats the day in the user's time zone", () => {
    expect(formatDate(instant, { locale, timeZone: "UTC" })).toBe(
      "Dec 31, 2026",
    );
    expect(formatDate(instant, { locale, timeZone: "Africa/Lagos" })).toBe(
      "Jan 1, 2027",
    );
  });

  it("formats date and time in the user's time zone", () => {
    expect(
      formatDateTime(instant, { locale, timeZone: "Africa/Lagos" }),
    ).toMatch(/^Jan 1, 2027, 12:30\sAM$/);
    expect(formatTime(instant, { locale, timeZone: "UTC" })).toMatch(
      /^11:30\sPM$/,
    );
  });

  it("ignores an unsupported time zone instead of throwing", () => {
    expect(resolveTimeZone("Not/AZone")).toBeUndefined();
    expect(resolveTimeZone("Africa/Lagos")).toBe("Africa/Lagos");
    expect(() =>
      formatDate(instant, { locale, timeZone: "Not/AZone" }),
    ).not.toThrow();
  });

  it("returns the fallback for missing or invalid instants", () => {
    expect(formatDate(null)).toBe(EMPTY_VALUE);
    expect(formatDateTime("not a date")).toBe(EMPTY_VALUE);
    expect(formatTime(undefined)).toBe(EMPTY_VALUE);
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");

  it("describes past and future instants", () => {
    expect(
      formatRelativeTime("2026-06-10T09:00:00.000Z", { locale, now }),
    ).toBe("3 hours ago");
    expect(
      formatRelativeTime("2026-06-12T12:00:00.000Z", { locale, now }),
    ).toBe("in 2 days");
    expect(formatRelativeTime("2026-06-09T12:00:00.000Z", { locale, now })).toBe(
      "yesterday",
    );
  });

  it("treats anything under a minute as now", () => {
    expect(
      formatRelativeTime("2026-06-10T11:59:40.000Z", { locale, now }),
    ).toBe("this minute");
  });

  it("returns the fallback for invalid input", () => {
    expect(formatRelativeTime("nope", { now })).toBe(EMPTY_VALUE);
  });
});

describe("calendar day arithmetic", () => {
  it("counts whole days until a calendar date", () => {
    const now = new Date("2026-06-10T23:59:00.000Z");
    expect(daysUntilCalendarDate("2026-06-10", now)).toBe(0);
    expect(daysUntilCalendarDate("2026-06-11", now)).toBe(1);
    expect(daysUntilCalendarDate("2026-06-01", now)).toBe(-9);
    expect(daysUntilCalendarDate(null, now)).toBeNull();
    expect(daysUntilCalendarDate("garbage", now)).toBeNull();
  });

  it("gives today's local date for date inputs", () => {
    expect(todayAsCalendarDate(new Date(2026, 0, 5, 23, 59))).toBe(
      "2026-01-05",
    );
  });
});

describe("formatMoneyMinor", () => {
  it("formats minor units in the contract's own currency", () => {
    expect(formatMoneyMinor("123456", "USD", { locale })).toBe("$1,234.56");
    expect(formatMoneyMinor("123456", "EUR", { locale })).toBe("€1,234.56");
    expect(spaced(formatMoneyMinor("5000000", "NGN", { locale }))).toBe(
      "NGN 50,000.00",
    );
  });

  it("respects each currency's minor-unit precision", () => {
    expect(formatMoneyMinor("1500", "JPY", { locale })).toBe("¥1,500");
    expect(spaced(formatMoneyMinor("1234567", "KWD", { locale }))).toBe(
      "KWD 1,234.567",
    );
  });

  it("formats large amounts exactly, up to the database's limits", () => {
    expect(formatMoneyMinor("900719925474099312", "USD", { locale })).toBe(
      "$9,007,199,254,740,993.12",
    );
    expect(formatMoneyMinor("9223372036854775807", "USD", { locale })).toBe(
      "$92,233,720,368,547,758.07",
    );
    expect(formatMoneyMinor("-9223372036854775808", "JPY", { locale })).toBe(
      "-¥9,223,372,036,854,775,808",
    );
  });

  it("handles small and negative amounts", () => {
    expect(formatMoneyMinor("5", "USD", { locale })).toBe("$0.05");
    expect(formatMoneyMinor("-250", "USD", { locale })).toBe("-$2.50");
    expect(spaced(formatMoneyMinor("-1", "KWD", { locale }))).toBe(
      "-KWD 0.001",
    );
    expect(formatMoneyMinor("0", "GBP", { locale })).toBe("£0.00");
  });

  it("returns the fallback for invalid amounts or currencies", () => {
    expect(formatMoneyMinor(null, "USD")).toBe(EMPTY_VALUE);
    expect(formatMoneyMinor("100", null)).toBe(EMPTY_VALUE);
    expect(formatMoneyMinor("100", "DOLLARS")).toBe(EMPTY_VALUE);
    for (const amount of ["12.5", "1e6", " 100", "007", "abc", ""]) {
      expect(formatMoneyMinor(amount, "USD"), amount).toBe(EMPTY_VALUE);
    }
    expect(formatMoneyMinor("9223372036854775808", "USD")).toBe(EMPTY_VALUE);
  });

  it("never shows a JavaScript number as an amount", () => {
    // Amounts arrive as strings; a number may already have lost digits.
    for (const amount of [12.5, 100, Number.NaN]) {
      expect(formatMoneyMinor(amount as unknown as MinorAmount, "USD")).toBe(
        EMPTY_VALUE,
      );
    }
  });
});

describe("number and percentage formatting", () => {
  it("groups counts and quantities", () => {
    expect(formatNumber(1234567, { locale })).toBe("1,234,567");
    expect(formatNumber(2.345, { locale })).toBe("2.35");
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe(EMPTY_VALUE);
    expect(formatNumber(null)).toBe(EMPTY_VALUE);
  });

  it("formats ratios and basis points as percentages", () => {
    expect(formatPercent(0.25, { locale })).toBe("25%");
    expect(formatPercent(0.125, { locale, maximumFractionDigits: 1 })).toBe(
      "12.5%",
    );
    expect(formatBasisPoints(500, { locale })).toBe("5%");
    expect(formatBasisPoints(125, { locale })).toBe("1.25%");
    expect(formatPercent(undefined)).toBe(EMPTY_VALUE);
    expect(formatBasisPoints(null)).toBe(EMPTY_VALUE);
  });
});

describe("formatFileSize", () => {
  it("uses bytes, KB or MB, whichever reads best", () => {
    expect(formatFileSize(12, { locale })).toBe("12 bytes");
    expect(formatFileSize(655_360, { locale })).toBe("640 KB");
    expect(formatFileSize(2_516_582, { locale })).toBe("2.4 MB");
    expect(formatFileSize(26_214_400, { locale })).toBe("25 MB");
    expect(formatFileSize(null)).toBe(EMPTY_VALUE);
  });
});

describe("humanizeEnumValue", () => {
  it("turns API enum values into readable labels", () => {
    expect(humanizeEnumValue("under_review")).toBe("Under review");
    expect(humanizeEnumValue("active")).toBe("Active");
    expect(humanizeEnumValue("epc")).toBe("EPC");
    expect(humanizeEnumValue("hse")).toBe("HSE");
    expect(humanizeEnumValue("company.member_removed")).toBe(
      "Company member removed",
    );
  });

  it("leaves readable values untouched and handles empty input", () => {
    expect(humanizeEnumValue("Company Administrator")).toBe(
      "Company Administrator",
    );
    expect(humanizeEnumValue("")).toBe(EMPTY_VALUE);
  });
});

describe("currencyDigits", () => {
  it("reads each currency's minor-unit precision", () => {
    expect(currencyDigits("NGN")).toBe(2);
    expect(currencyDigits("JPY")).toBe(0);
    expect(currencyDigits("BHD")).toBe(3);
    expect(currencyDigits("NOT-A-CODE")).toBeNull();
  });
});

describe("parseDecimalToMinor", () => {
  it("converts a decimal amount to whole minor units, as an integer string, exactly", () => {
    expect(parseDecimalToMinor("1500000.50", "NGN")).toBe("150000050");
    expect(parseDecimalToMinor("2,500,000.00", "NGN")).toBe("250000000");
    expect(parseDecimalToMinor("1500000", "NGN")).toBe("150000000");
    expect(parseDecimalToMinor("0.1", "USD")).toBe("10");
    expect(parseDecimalToMinor(" 12.34 ", "USD")).toBe("1234");
    // 0.29 * 100 is 28.999999999999996 in floating point.
    expect(parseDecimalToMinor("0.29", "USD")).toBe("29");
  });

  it("writes canonical digits, without leading zeros", () => {
    expect(parseDecimalToMinor("0.05", "USD")).toBe("5");
    expect(parseDecimalToMinor("0", "USD")).toBe("0");
    expect(parseDecimalToMinor("0.00", "USD")).toBe("0");
    expect(parseDecimalToMinor("007.50", "USD")).toBe("750");
  });

  it("reads commas as grouping wherever they can only be grouping", () => {
    expect(parseDecimalToMinor("1,500,000.50", "NGN")).toBe("150000050");
    // Moved by an edit, or grouped Indian-style: still the digits as written.
    expect(parseDecimalToMinor("1,50,000", "NGN")).toBe("15000000");
    expect(parseDecimalToMinor("1,500,00", "NGN")).toBe("15000000");
    expect(parseDecimalToMinor(",500,000", "NGN")).toBe("50000000");
    expect(parseDecimalToMinor("1,50,000.5", "NGN")).toBe("15000050");
  });

  it("refuses a single comma that might be a decimal separator", () => {
    expect(parseDecimalToMinor("15,00", "NGN")).toBeNull();
    expect(parseDecimalToMinor("1,5000", "NGN")).toBeNull();
    expect(parseDecimalToMinor("500,", "NGN")).toBeNull();
    expect(parseDecimalToMinor(",", "NGN")).toBeNull();
    expect(parseDecimalToMinor(",,", "NGN")).toBeNull();
  });

  it("follows the currency's precision and never rounds", () => {
    expect(parseDecimalToMinor("500", "JPY")).toBe("500");
    expect(parseDecimalToMinor("500.5", "JPY")).toBeNull();
    expect(parseDecimalToMinor("1.234", "BHD")).toBe("1234");
    expect(parseDecimalToMinor("1.5", "KWD")).toBe("1500");
    expect(parseDecimalToMinor("1.234", "USD")).toBeNull();
  });

  it("rejects anything that is not a non-negative amount", () => {
    for (const text of ["", " ", "-5", "1e6", "12.", ".5", "abc", "1 000"]) {
      expect(parseDecimalToMinor(text, "USD"), text).toBeNull();
    }
    expect(parseDecimalToMinor("10", "NOT-A-CODE")).toBeNull();
  });

  it("keeps amounts beyond the safe integer range exact, up to the database's limit", () => {
    expect(parseDecimalToMinor("90071992547409.93", "USD")).toBe(
      "9007199254740993",
    );
    expect(parseDecimalToMinor("92,233,720,368,547,758.07", "USD")).toBe(
      "9223372036854775807",
    );
    expect(parseDecimalToMinor("92233720368547758.08", "USD")).toBeNull();
    expect(parseDecimalToMinor("9223372036854775808", "JPY")).toBeNull();
  });
});

describe("groupDecimalInput", () => {
  it("adds grouping commas to a typed amount", () => {
    expect(groupDecimalInput("1500000")).toBe("1,500,000");
    expect(groupDecimalInput("2500000.00")).toBe("2,500,000.00");
    expect(groupDecimalInput("999")).toBe("999");
    expect(groupDecimalInput("1000")).toBe("1,000");
    expect(groupDecimalInput(" 1500 ")).toBe("1,500");
  });

  it("keeps the decimals exactly as typed, never padding or rounding them", () => {
    expect(groupDecimalInput("1500000.5")).toBe("1,500,000.5");
    expect(groupDecimalInput("1234.5678")).toBe("1,234.5678");
    expect(groupDecimalInput("0.29")).toBe("0.29");
  });

  it("regroups correctly grouped amounts and drops leading zeros", () => {
    expect(groupDecimalInput("1,500,000.50")).toBe("1,500,000.50");
    expect(groupDecimalInput("007.50")).toBe("7.50");
    expect(groupDecimalInput("0")).toBe("0");
  });

  it("regroups an amount after an edit has moved its commas", () => {
    // A zero removed from "1,500,000", from either group.
    expect(groupDecimalInput("1,50,000")).toBe("150,000");
    expect(groupDecimalInput("1,500,00")).toBe("150,000");
    // The leading digit removed.
    expect(groupDecimalInput(",500,000")).toBe("500,000");
    // A digit added.
    expect(groupDecimalInput("1,5000,000")).toBe("15,000,000");
    expect(groupDecimalInput("1,50,000.5")).toBe("150,000.5");
  });

  it("groups large amounts exactly, without going through a number", () => {
    expect(groupDecimalInput("92233720368547758.07")).toBe(
      "92,233,720,368,547,758.07",
    );
  });

  it("leaves text it can't read unchanged, so its amount can't change", () => {
    // "15,00" could be a mistyped 15.00; regrouping it would make it 1,500.
    for (const text of ["15,00", "1,5000", "12.", ".5", "-5", "1e6", "abc", "1 000", ""]) {
      expect(groupDecimalInput(text), text).toBe(text);
    }
  });

  it("never changes the amount it represents", () => {
    for (const text of ["1500000.5", "1,500,000.50", "007.50", "1234.567"]) {
      expect(parseDecimalToMinor(groupDecimalInput(text), "KWD"), text).toBe(
        parseDecimalToMinor(text, "KWD"),
      );
    }
  });
});

describe("parsePercentToBasisPoints", () => {
  it("converts a percentage to basis points", () => {
    expect(parsePercentToBasisPoints("5")).toBe(500);
    expect(parsePercentToBasisPoints("2.5")).toBe(250);
    expect(parsePercentToBasisPoints("12.25")).toBe(1225);
    expect(parsePercentToBasisPoints("0")).toBe(0);
    expect(parsePercentToBasisPoints("100")).toBe(10_000);
  });

  it("rejects values outside 0-100 or finer than basis points", () => {
    for (const text of ["", "100.01", "101", "-1", "2.555", "5%", "abc"]) {
      expect(parsePercentToBasisPoints(text), text).toBeNull();
    }
  });
});

describe("dayBoundsInTimeZone", () => {
  it("covers the whole day as the viewer's time zone lives it", () => {
    expect(dayBoundsInTimeZone("2026-03-16", "Africa/Lagos")).toEqual({
      start: "2026-03-15T23:00:00.000Z",
      end: "2026-03-16T22:59:59.999Z",
    });
    expect(dayBoundsInTimeZone("2026-03-16", "UTC")).toEqual({
      start: "2026-03-16T00:00:00.000Z",
      end: "2026-03-16T23:59:59.999Z",
    });
  });

  it("handles days on which the clocks change", () => {
    // London springs forward: a 23-hour day.
    expect(dayBoundsInTimeZone("2026-03-29", "Europe/London")).toEqual({
      start: "2026-03-29T00:00:00.000Z",
      end: "2026-03-29T22:59:59.999Z",
    });
    // New York falls back: a 25-hour day.
    expect(dayBoundsInTimeZone("2026-11-01", "America/New_York")).toEqual({
      start: "2026-11-01T04:00:00.000Z",
      end: "2026-11-02T04:59:59.999Z",
    });
  });

  it("rejects anything that isn't a real calendar day", () => {
    for (const value of [
      "2026-02-30",
      "2026-13-01",
      "10/11/2026",
      "",
      "2026-11-10T00:00",
    ]) {
      expect(dayBoundsInTimeZone(value, "UTC")).toBeNull();
    }
  });
});
