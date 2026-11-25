import { describe, expect, it } from "vitest";
import {
  EContractStatus,
  EContractType,
  ECurrencyCode,
  EPartyType,
} from "@contractflow/contracts-schema";
import type { Contract } from "@/services/contractApi";
import {
  basisPointsToPercentInput,
  minorToDecimalInput,
  parseDecimalToMinor,
  parsePercentToBasisPoints,
} from "@/lib/format";
import {
  contractToFormValues,
  editContractSteps,
  createContractFormSchema,
  isContractValueLocked,
  toUpdateContractRequest,
} from "./create-contract-schema";

function contract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract-1",
    referenceNumber: "CTR-001",
    title: "Pipeline maintenance",
    description: null,
    contractType: EContractType.MAINTENANCE,
    status: EContractStatus.DRAFT,
    parentContractId: null,
    originalValueMinor: "150000050",
    currentValueMinor: "150000050",
    currencyCode: ECurrencyCode.NGN,
    retentionRateBps: 500,
    advancePaymentRateBps: 1250,
    paymentTermsDays: 30,
    liquidatedDamagesPerDayMinor: "250000",
    awardDate: "2026-01-01T00:00:00.000Z",
    startDate: "2026-02-01T00:00:00.000Z",
    endDate: "2026-12-31T00:00:00.000Z",
    revisedEndDate: null,
    defectsLiabilityDays: 365,
    timezone: "Africa/Lagos",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

describe("editing values round-trip exactly", () => {
  it("shows stored amounts in the currency's decimals, and reads them back unchanged", () => {
    expect(minorToDecimalInput("150000050", "NGN")).toBe("1,500,000.50");
    expect(minorToDecimalInput("1500000", "JPY")).toBe("1,500,000");
    expect(minorToDecimalInput("1500125", "KWD")).toBe("1,500.125");
    expect(minorToDecimalInput("5", "USD")).toBe("0.05");
    // Beyond Number.MAX_SAFE_INTEGER, still exact.
    expect(minorToDecimalInput("9007199254740993", "USD")).toBe(
      "90,071,992,547,409.93",
    );
    for (const [amount, currency] of [
      ["150000050", "NGN"],
      ["1500000", "JPY"],
      ["1500125", "KWD"],
      ["9007199254740993", "USD"],
      ["0", "USD"],
    ] as const) {
      expect(
        parseDecimalToMinor(minorToDecimalInput(amount, currency)!, currency),
      ).toBe(amount);
    }
  });

  it("refuses amounts the fields can't hold", () => {
    expect(minorToDecimalInput("-1", "USD")).toBeNull();
    expect(minorToDecimalInput("12.5", "USD")).toBeNull();
    expect(minorToDecimalInput("100", "NOT-A-CODE")).toBeNull();
  });

  it("shows basis points as typed percentages, and reads them back unchanged", () => {
    expect(basisPointsToPercentInput(500)).toBe("5");
    expect(basisPointsToPercentInput(1250)).toBe("12.5");
    expect(basisPointsToPercentInput(1225)).toBe("12.25");
    expect(basisPointsToPercentInput(5)).toBe("0.05");
    expect(basisPointsToPercentInput(0)).toBe("0");
    expect(basisPointsToPercentInput(10000)).toBe("100");
    for (const bps of [0, 5, 50, 500, 1225, 1250, 9999, 10000]) {
      expect(parsePercentToBasisPoints(basisPointsToPercentInput(bps))).toBe(
        bps,
      );
    }
  });
});

describe("contractToFormValues", () => {
  it("fills every step from the contract, and passes the form's own checks", () => {
    const values = contractToFormValues(contract(), EPartyType.AWARDING);
    expect(values).toMatchObject({
      basics: {
        referenceNumber: "CTR-001",
        title: "Pipeline maintenance",
        description: "",
      },
      parties: { partyType: EPartyType.AWARDING, parentContractId: "" },
      commercial: {
        currencyCode: ECurrencyCode.NGN,
        originalValue: "1,500,000.50",
        retentionRate: "5",
        advancePaymentRate: "12.5",
        liquidatedDamagesPerDay: "2,500.00",
        paymentTermsDays: "30",
      },
      dates: {
        awardDate: "2026-01-01",
        startDate: "2026-02-01",
        endDate: "2026-12-31",
        revisedEndDate: "",
        defectsLiabilityDays: "365",
        timezone: "Africa/Lagos",
      },
    });
    expect(createContractFormSchema.safeParse(values).success).toBe(true);
  });

  it("leaves optional values empty when the contract has none", () => {
    const values = contractToFormValues(
      contract({
        advancePaymentRateBps: null,
        liquidatedDamagesPerDayMinor: null,
      }),
      EPartyType.AWARDING,
    );
    expect(values.commercial.advancePaymentRate).toBe("");
    expect(values.commercial.liquidatedDamagesPerDay).toBe("");
  });
});

describe("toUpdateContractRequest", () => {
  it("sends what the update changes, never the reference, party type or workspaces", () => {
    const values = contractToFormValues(contract(), EPartyType.AWARDING);
    values.basics.title = "Pipeline maintenance (phase 2)";
    const body = toUpdateContractRequest(values, { valueLocked: false });

    expect(body).toMatchObject({
      title: "Pipeline maintenance (phase 2)",
      description: null,
      originalValueMinor: "150000050",
      currencyCode: ECurrencyCode.NGN,
      retentionRateBps: 500,
      advancePaymentRateBps: 1250,
      liquidatedDamagesPerDayMinor: "250000",
      startDate: "2026-02-01",
    });
    expect(body).not.toHaveProperty("referenceNumber");
    expect(body).not.toHaveProperty("partyType");
    expect(body).not.toHaveProperty("workspaces");
    // The parent is fixed at creation; editing never sends it.
    expect(body).not.toHaveProperty("parentContractId");
  });

  it("has no parties or parent contract step", () => {
    expect(editContractSteps.map(({ id, title }) => [id, title])).toEqual([
      ["basics", "Basics"],
      ["commercial", "Commercial terms"],
      ["dates", "Dates"],
    ]);
  });

  it("leaves the value and currency out once the contract has left draft", () => {
    expect(isContractValueLocked(contract())).toBe(false);
    const active = contract({ status: EContractStatus.ACTIVE });
    expect(isContractValueLocked(active)).toBe(true);

    const body = toUpdateContractRequest(
      contractToFormValues(active, EPartyType.AWARDING),
      { valueLocked: true },
    );
    expect(body).not.toHaveProperty("originalValueMinor");
    expect(body).not.toHaveProperty("currencyCode");
    // Other terms still change, amounts in the contract's own currency.
    expect(body.liquidatedDamagesPerDayMinor).toBe("250000");
  });
});
