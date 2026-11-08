import { describe, expect, it } from "vitest";
import {
  EMPTY_VALUE,
  daysUntilCalendarDate,
  formatBasisPoints,
  formatCalendarDate,
  formatDate,
  formatDateTime,
  formatMoneyMinor,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatTime,
  humanizeEnumValue,
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
    expect(formatMoneyMinor(123456, "USD", { locale })).toBe("$1,234.56");
    expect(formatMoneyMinor(123456, "EUR", { locale })).toBe("€1,234.56");
    expect(spaced(formatMoneyMinor(5000000, "NGN", { locale }))).toBe(
      "NGN 50,000.00",
    );
  });

  it("respects each currency's minor-unit precision", () => {
    expect(formatMoneyMinor(1500, "JPY", { locale })).toBe("¥1,500");
    expect(spaced(formatMoneyMinor(1234567, "KWD", { locale }))).toBe(
      "KWD 1,234.567",
    );
  });

  it("formats large string amounts exactly", () => {
    expect(formatMoneyMinor("900719925474099312", "USD", { locale })).toBe(
      "$9,007,199,254,740,993.12",
    );
  });

  it("handles small and negative amounts", () => {
    expect(formatMoneyMinor(5, "USD", { locale })).toBe("$0.05");
    expect(formatMoneyMinor("-250", "USD", { locale })).toBe("-$2.50");
    expect(formatMoneyMinor(0, "GBP", { locale })).toBe("£0.00");
  });

  it("returns the fallback for invalid amounts or currencies", () => {
    expect(formatMoneyMinor(null, "USD")).toBe(EMPTY_VALUE);
    expect(formatMoneyMinor(100, null)).toBe(EMPTY_VALUE);
    expect(formatMoneyMinor(100, "DOLLARS")).toBe(EMPTY_VALUE);
    expect(formatMoneyMinor("12.5", "USD")).toBe(EMPTY_VALUE);
    expect(formatMoneyMinor(12.5, "USD")).toBe(EMPTY_VALUE);
    expect(formatMoneyMinor(Number.NaN, "USD")).toBe(EMPTY_VALUE);
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
