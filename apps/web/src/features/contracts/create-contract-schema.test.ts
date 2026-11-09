import { describe, expect, it } from "vitest";
import {
  EContractType,
  ECurrencyCode,
  EPartyType,
} from "@contractflow/contracts-schema";
import {
  createContractDefaults,
  createContractFormSchema,
  createContractSteps,
  defaultTimeZone,
  timeZoneOptions,
  toCreateContractRequest,
  validateContractDates,
  type ContractDateValues,
  type CreateContractFormValues,
} from "./create-contract-schema";

const validDates: ContractDateValues = {
  awardDate: "2026-01-01",
  startDate: "2026-02-01",
  endDate: "2026-12-31",
  revisedEndDate: "",
  actualCompletionDate: "",
};

describe("validateContractDates", () => {
  it("accepts dates in order and leaves optional dates empty", () => {
    expect(validateContractDates(validDates)).toEqual({});
  });

  it("accepts a start date equal to the end date", () => {
    expect(
      validateContractDates({ ...validDates, startDate: "2026-12-31" }),
    ).toEqual({});
  });

  it("flags a start date after the end date on the start date", () => {
    expect(
      validateContractDates({ ...validDates, startDate: "2027-01-01" }),
    ).toEqual({
      startDate: "The start date must not be after the end date.",
    });
  });

  it("flags a revised end date before the end date", () => {
    expect(
      validateContractDates({ ...validDates, revisedEndDate: "2026-12-30" }),
    ).toEqual({
      revisedEndDate: "The revised end date must not be before the end date.",
    });
  });

  it("flags an actual completion date before the start date", () => {
    expect(
      validateContractDates({
        ...validDates,
        actualCompletionDate: "2026-01-31",
      }),
    ).toEqual({
      actualCompletionDate:
        "The actual completion date must not be before the start date.",
    });
  });
});

function validValues(): CreateContractFormValues {
  const values = createContractDefaults("Africa/Lagos");
  return {
    basics: {
      ...values.basics,
      referenceNumber: " CTR-001 ",
      title: " Pipeline maintenance ",
      contractType: EContractType.MAINTENANCE,
    },
    parties: { ...values.parties, partyType: EPartyType.CLIENT },
    commercial: {
      ...values.commercial,
      currencyCode: ECurrencyCode.NGN,
      originalValue: "1,500,000.50",
      retentionRate: "5",
      advancePaymentRate: "12.5",
      liquidatedDamagesPerDay: "2500",
    },
    dates: { ...values.dates, ...validDates },
  };
}

/** The validation messages for each field path, e.g. "commercial.retentionRate". */
function issues(values: unknown): Record<string, string> {
  const result = createContractFormSchema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

describe("createContractFormSchema", () => {
  it("accepts a complete contract", () => {
    expect(issues(validValues())).toEqual({});
  });

  it("has one group per step, in order", () => {
    expect(createContractSteps.map((step) => step.id)).toEqual(
      Object.keys(createContractFormSchema.shape),
    );
  });

  it("requires the basics", () => {
    const values = validValues();
    values.basics.referenceNumber = "  ";
    values.basics.title = "";
    expect(issues(values)).toEqual({
      "basics.referenceNumber": "Enter a reference number.",
      "basics.title": "Enter a contract title.",
    });
  });

  it("checks amounts against the chosen currency while other steps are empty", () => {
    // Steps validate independently, so a later empty step doesn't hide this.
    const values = validValues();
    values.dates = createContractDefaults("UTC").dates;
    values.commercial.originalValue = "1500.555";
    values.commercial.liquidatedDamagesPerDay = "-1";
    const messages = issues(values);

    expect(messages["commercial.originalValue"]).toBe(
      "Enter an amount in NGN, such as 1500000.00, with at most 2 decimal places.",
    );
    expect(messages["commercial.liquidatedDamagesPerDay"]).toBe(
      messages["commercial.originalValue"],
    );
    expect(messages["dates.awardDate"]).toBe("Enter the award date.");

    values.commercial.currencyCode = ECurrencyCode.JPY;
    values.commercial.originalValue = "1500.5";
    expect(issues(values)["commercial.originalValue"]).toBe(
      "Enter a whole amount in JPY, without decimals.",
    );
  });

  it("checks percentages and day counts", () => {
    const values = validValues();
    values.commercial.retentionRate = "150";
    values.commercial.advancePaymentRate = "2.555";
    values.commercial.paymentTermsDays = "30.5";
    values.dates.defectsLiabilityDays = "3000000000";
    expect(issues(values)).toEqual({
      "commercial.retentionRate":
        "Enter a percentage from 0 to 100, with at most 2 decimal places.",
      "commercial.advancePaymentRate":
        "Enter a percentage from 0 to 100, with at most 2 decimal places.",
      "commercial.paymentTermsDays":
        "Enter the payment terms as a whole number of days.",
      "dates.defectsLiabilityDays":
        "Enter the defects liability period as a whole number of days.",
    });
  });

  it("puts date-order errors on the date concerned", () => {
    const values = validValues();
    values.dates.startDate = "2027-02-01";
    expect(issues(values)).toEqual({
      "dates.startDate": "The start date must not be after the end date.",
    });
  });
});

describe("toCreateContractRequest", () => {
  it("sends minor units, basis points and trimmed text", () => {
    expect(toCreateContractRequest(validValues())).toEqual({
      referenceNumber: "CTR-001",
      title: "Pipeline maintenance",
      description: null,
      contractType: EContractType.MAINTENANCE,
      partyType: EPartyType.CLIENT,
      workspaces: ["project", "hse", "finance"],
      parentContractId: null,
      originalValueMinor: 150000050,
      currencyCode: ECurrencyCode.NGN,
      retentionRateBps: 500,
      advancePaymentRateBps: 1250,
      paymentTermsDays: 30,
      liquidatedDamagesPerDayMinor: 250000,
      awardDate: "2026-01-01",
      startDate: "2026-02-01",
      endDate: "2026-12-31",
      revisedEndDate: null,
      actualCompletionDate: null,
      defectsLiabilityDays: 0,
      timezone: "Africa/Lagos",
    });
  });

  it("sends null for blank optional values and keeps workspace order", () => {
    const values = validValues();
    values.commercial.advancePaymentRate = "";
    values.commercial.liquidatedDamagesPerDay = "";
    values.parties.workspaces = ["finance", "project"];
    values.parties.parentContractId = "01J0000000000000000000000A";
    const request = toCreateContractRequest(values);

    expect(request.advancePaymentRateBps).toBeNull();
    expect(request.liquidatedDamagesPerDayMinor).toBeNull();
    expect(request.workspaces).toEqual(["project", "finance"]);
    expect(request.parentContractId).toBe("01J0000000000000000000000A");
  });

  it("refuses values that have not passed validation", () => {
    const values = validValues();
    values.commercial.originalValue = "1.234";
    expect(() => toCreateContractRequest(values)).toThrow();
  });
});

describe("time zones", () => {
  it("lists UTC first, then the runtime's IANA zones", () => {
    const zones = timeZoneOptions();
    expect(zones[0]).toBe("UTC");
    expect(zones).toContain("Africa/Lagos");
    expect(zones.filter((zone) => zone === "UTC")).toHaveLength(1);
  });

  it("defaults to a listed zone", () => {
    const zones = timeZoneOptions();
    expect(zones).toContain(defaultTimeZone(zones));
    expect(defaultTimeZone(["UTC"])).toBe("UTC");
  });
});
