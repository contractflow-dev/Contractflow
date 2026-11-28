import { describe, expect, it } from "vitest";
import {
  EContractStatus,
  EContractType,
  ECurrencyCode,
  EPartyType,
} from "@contractflow/contracts-schema";
import type { ContractListItem } from "@/services/contractApi";
import {
  createContractDefaults,
  createContractFormSchema,
  createContractSteps,
  defaultTimeZone,
  eligibleParentContracts,
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

  it("has no actual completion date: completion is the contract's status history", () => {
    expect(Object.keys(validDates)).not.toContain("actualCompletionDate");
    expect(createContractDefaults("UTC").dates).not.toHaveProperty(
      "actualCompletionDate",
    );
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
    parties: { ...values.parties, partyType: EPartyType.AWARDING },
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
  it("sends minor units as integer strings, basis points and trimmed text", () => {
    expect(toCreateContractRequest(validValues())).toEqual({
      referenceNumber: "CTR-001",
      title: "Pipeline maintenance",
      description: null,
      contractType: EContractType.MAINTENANCE,
      partyType: EPartyType.AWARDING,
      workspaces: ["project", "hse", "finance"],
      parentContractId: null,
      originalValueMinor: "150000050",
      currencyCode: ECurrencyCode.NGN,
      retentionRateBps: 500,
      advancePaymentRateBps: 1250,
      paymentTermsDays: 30,
      liquidatedDamagesPerDayMinor: "250000",
      awardDate: "2026-01-01",
      startDate: "2026-02-01",
      endDate: "2026-12-31",
      revisedEndDate: null,
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

  it("sends each chosen workspace once, whatever the form holds", () => {
    const values = validValues();
    values.parties.workspaces = ["hse", "hse", "project", "hse"];

    expect(toCreateContractRequest(values).workspaces).toEqual([
      "project",
      "hse",
    ]);
  });

  it("allows a contract with no workspaces, to add later", () => {
    const values = validValues();
    values.parties.workspaces = [];

    expect(toCreateContractRequest(values).workspaces).toEqual([]);
  });

  it("sends amounts in each currency's own minor units, exactly at any size", () => {
    const yen = validValues();
    yen.commercial.currencyCode = ECurrencyCode.JPY;
    yen.commercial.originalValue = "1,500,000";
    yen.commercial.liquidatedDamagesPerDay = "";
    expect(toCreateContractRequest(yen).originalValueMinor).toBe("1500000");

    const dinar = validValues();
    dinar.commercial.currencyCode = ECurrencyCode.KWD;
    dinar.commercial.originalValue = "1500.125";
    dinar.commercial.liquidatedDamagesPerDay = "0.5";
    const kwd = toCreateContractRequest(dinar);
    expect(kwd.originalValueMinor).toBe("1500125");
    expect(kwd.liquidatedDamagesPerDayMinor).toBe("500");

    // Beyond Number.MAX_SAFE_INTEGER minor units, which a number would round.
    const large = validValues();
    large.commercial.originalValue = "90071992547409.93";
    expect(toCreateContractRequest(large).originalValueMinor).toBe(
      "9007199254740993",
    );
  });

  it("sends a JSON body with amounts as strings, not numbers", () => {
    const body = JSON.parse(
      JSON.stringify(toCreateContractRequest(validValues())),
    );
    expect(typeof body.originalValueMinor).toBe("string");
    expect(typeof body.liquidatedDamagesPerDayMinor).toBe("string");
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

describe("subcontracts", () => {
  it("makes your company the awarding party, on a main contract or a subcontract", () => {
    const values = validValues();
    expect(createContractDefaults("UTC").parties.partyType).toBe(
      EPartyType.AWARDING,
    );
    expect(issues(values)).toEqual({});
    values.parties.parentContractId = "01JD4X2Y3Z4A5B6C7D8E9F0G1H";
    expect(issues(values)).toEqual({});
    // An awarded creator is refused, as by the API.
    (values.parties as { partyType: EPartyType }).partyType =
      EPartyType.AWARDED;
    expect(Object.keys(issues(values))).toEqual(["parties.partyType"]);
  });

  it("offers as parents only main contracts awarded to your company, draft or active", () => {
    const listed = (overrides: Partial<ContractListItem>) =>
      ({
        id: overrides.referenceNumber,
        parentContractId: null,
        deletedAt: null,
        status: EContractStatus.ACTIVE,
        myPartyType: EPartyType.AWARDED,
        ...overrides,
      }) as ContractListItem;
    const contracts = [
      listed({ referenceNumber: "ACTIVE" }),
      listed({ referenceNumber: "DRAFT", status: EContractStatus.DRAFT }),
      listed({
        referenceNumber: "SUSPENDED",
        status: EContractStatus.SUSPENDED,
      }),
      listed({
        referenceNumber: "COMPLETED",
        status: EContractStatus.COMPLETED,
      }),
      listed({ referenceNumber: "CLIENT", myPartyType: EPartyType.AWARDING }),
      listed({ referenceNumber: "SUB", parentContractId: "main" }),
      listed({ referenceNumber: "ARCHIVED", deletedAt: "2026-06-01" }),
    ];
    expect(
      eligibleParentContracts(contracts).map((c) => c.referenceNumber),
    ).toEqual(["ACTIVE", "DRAFT"]);
  });
});
