import { z } from "zod";
import {
  EContractStatus,
  EContractType,
  ECurrencyCode,
  EPartyType,
} from "@contractflow/contracts-schema";
import {
  basisPointsToPercentInput,
  currencyDigits,
  minorToDecimalInput,
  parseDecimalToMinor,
  parsePercentToBasisPoints,
} from "@/lib/format";
import type {
  AssignableContractWorkspace,
  Contract,
  CreateContractRequest,
} from "@/services/contractApi";

export const contractWorkspaces: AssignableContractWorkspace[] = [
  "project",
  "hse",
  "finance",
];

/** The date fields of a new contract, as entered (YYYY-MM-DD or empty). */
export interface ContractDateValues {
  awardDate: string;
  startDate: string;
  endDate: string;
  revisedEndDate: string;
  actualCompletionDate: string;
}

export type ContractDateErrors = Partial<
  Record<keyof ContractDateValues, string>
>;

/**
 * The date-order rules the API enforces when a contract is saved, checked
 * before submitting so each message appears next to the field it concerns.
 * The API still validates every request.
 */
export function validateContractDates(
  values: ContractDateValues,
): ContractDateErrors {
  const errors: ContractDateErrors = {};
  const { startDate, endDate, revisedEndDate, actualCompletionDate } = values;
  // ISO calendar dates compare correctly as strings.
  if (startDate && endDate && startDate > endDate) {
    errors.startDate = "The start date must not be after the end date.";
  }
  if (revisedEndDate && endDate && revisedEndDate < endDate) {
    errors.revisedEndDate =
      "The revised end date must not be before the end date.";
  }
  if (actualCompletionDate && startDate && actualCompletionDate < startDate) {
    errors.actualCompletionDate =
      "The actual completion date must not be before the start date.";
  }
  return errors;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Postgres `int`, the column type of the day counts. */
const MAX_DAYS = 2_147_483_647;

const requiredDate = (message: string) =>
  z.string().regex(ISO_DATE, message);
const optionalDate = z
  .string()
  .refine((value) => value === "" || ISO_DATE.test(value), "Enter a valid date.");
const days = (message: string) =>
  z
    .string()
    .trim()
    .refine(
      (value) => /^\d+$/.test(value) && Number(value) <= MAX_DAYS,
      message,
    );

function amountMessage(currencyCode: ECurrencyCode): string {
  const digits = currencyDigits(currencyCode) ?? 2;
  return digits === 0
    ? `Enter a whole amount in ${currencyCode}, without decimals.`
    : `Enter an amount in ${currencyCode}, such as 1500000.${"0".repeat(digits)}, with at most ${digits} decimal places.`;
}

const PERCENT_MESSAGE =
  "Enter a percentage from 0 to 100, with at most 2 decimal places.";

/**
 * The new-contract form, one group per step so each step validates on its own:
 * a group's cross-field checks run as soon as its own fields are valid,
 * whatever the other steps hold.
 */
export const createContractFormSchema = z.object({
  basics: z.object({
    referenceNumber: z
      .string()
      .trim()
      .min(1, "Enter a reference number.")
      .max(40, "Use 40 characters or fewer."),
    title: z
      .string()
      .trim()
      .min(1, "Enter a contract title.")
      .max(255, "Use 255 characters or fewer."),
    contractType: z.enum(EContractType, {
      message: "Choose a contract type.",
    }),
    description: z.string().trim(),
  }),
  parties: z.object({
    partyType: z.enum(EPartyType, {
      message: "Choose your company's party type.",
    }),
    parentContractId: z.string(),
    workspaces: z.array(z.enum(["project", "hse", "finance"])),
  }),
  commercial: z
    .object({
      currencyCode: z.enum(ECurrencyCode, { message: "Choose a currency." }),
      originalValue: z.string().trim().min(1, "Enter the contract value."),
      paymentTermsDays: days("Enter the payment terms as a whole number of days."),
      retentionRate: z
        .string()
        .trim()
        .min(1, "Enter a retention rate, or 0 for none."),
      advancePaymentRate: z.string().trim(),
      liquidatedDamagesPerDay: z.string().trim(),
    })
    .superRefine((values, context) => {
      const message = amountMessage(values.currencyCode);
      if (parseDecimalToMinor(values.originalValue, values.currencyCode) === null) {
        context.addIssue({ code: "custom", path: ["originalValue"], message });
      }
      if (
        values.liquidatedDamagesPerDay &&
        parseDecimalToMinor(values.liquidatedDamagesPerDay, values.currencyCode) ===
          null
      ) {
        context.addIssue({
          code: "custom",
          path: ["liquidatedDamagesPerDay"],
          message,
        });
      }
      if (parsePercentToBasisPoints(values.retentionRate) === null) {
        context.addIssue({
          code: "custom",
          path: ["retentionRate"],
          message: PERCENT_MESSAGE,
        });
      }
      if (
        values.advancePaymentRate &&
        parsePercentToBasisPoints(values.advancePaymentRate) === null
      ) {
        context.addIssue({
          code: "custom",
          path: ["advancePaymentRate"],
          message: PERCENT_MESSAGE,
        });
      }
    }),
  dates: z
    .object({
      awardDate: requiredDate("Enter the award date."),
      startDate: requiredDate("Enter the start date."),
      endDate: requiredDate("Enter the end date."),
      revisedEndDate: optionalDate,
      actualCompletionDate: optionalDate,
      defectsLiabilityDays: days(
        "Enter the defects liability period as a whole number of days.",
      ),
      timezone: z.string().min(1, "Choose a time zone."),
    })
    .superRefine((values, context) => {
      const errors = validateContractDates(values);
      for (const [field, message] of Object.entries(errors)) {
        context.addIssue({ code: "custom", path: [field], message });
      }
    }),
});

export type CreateContractFormValues = z.infer<typeof createContractFormSchema>;
export type CreateContractStepId = keyof CreateContractFormValues;

export const createContractSteps: Array<{
  id: CreateContractStepId;
  title: string;
}> = [
  { id: "basics", title: "Basics" },
  { id: "parties", title: "Parties & workspaces" },
  { id: "commercial", title: "Commercial terms" },
  { id: "dates", title: "Dates" },
];

/** The user's own time zone when the API accepts it, otherwise UTC. */
export function defaultTimeZone(zones: readonly string[]): string {
  try {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (local && zones.includes(local)) return local;
  } catch {
    // Fall through to UTC.
  }
  return "UTC";
}

/** IANA time zones this runtime knows, UTC first. */
export function timeZoneOptions(): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [];
  }
  return ["UTC", ...zones.filter((zone) => zone !== "UTC")];
}

export function createContractDefaults(
  timezone: string,
): CreateContractFormValues {
  return {
    basics: {
      referenceNumber: "",
      title: "",
      contractType: Object.values(EContractType)[0],
      description: "",
    },
    parties: {
      partyType: Object.values(EPartyType)[0],
      parentContractId: "",
      workspaces: [...contractWorkspaces],
    },
    commercial: {
      currencyCode: ECurrencyCode.USD,
      originalValue: "",
      paymentTermsDays: "30",
      retentionRate: "0",
      advancePaymentRate: "",
      liquidatedDamagesPerDay: "",
    },
    dates: {
      awardDate: "",
      startDate: "",
      endDate: "",
      revisedEndDate: "",
      actualCompletionDate: "",
      defectsLiabilityDays: "0",
      timezone,
    },
  };
}

function required<T>(value: T | null, field: string): T {
  if (value === null) throw new Error(`${field} is not valid.`);
  return value;
}

/**
 * The API request for validated form values: amounts become minor units and
 * percentages basis points. Throws if a value has not passed the schema.
 */
export function toCreateContractRequest(
  values: CreateContractFormValues,
): CreateContractRequest {
  const { basics, parties, commercial, dates } = values;
  const { currencyCode } = commercial;
  return {
    referenceNumber: basics.referenceNumber.trim(),
    title: basics.title.trim(),
    description: basics.description.trim() || null,
    contractType: basics.contractType,
    partyType: parties.partyType,
    workspaces: contractWorkspaces.filter((workspace) =>
      parties.workspaces.includes(workspace),
    ),
    parentContractId: parties.parentContractId || null,
    originalValueMinor: required(
      parseDecimalToMinor(commercial.originalValue, currencyCode),
      "Contract value",
    ),
    currencyCode,
    retentionRateBps: required(
      parsePercentToBasisPoints(commercial.retentionRate),
      "Retention rate",
    ),
    advancePaymentRateBps: commercial.advancePaymentRate
      ? required(
          parsePercentToBasisPoints(commercial.advancePaymentRate),
          "Advance payment rate",
        )
      : null,
    paymentTermsDays: Number(commercial.paymentTermsDays),
    liquidatedDamagesPerDayMinor: commercial.liquidatedDamagesPerDay
      ? required(
          parseDecimalToMinor(commercial.liquidatedDamagesPerDay, currencyCode),
          "Liquidated damages",
        )
      : null,
    awardDate: dates.awardDate,
    startDate: dates.startDate,
    endDate: dates.endDate,
    revisedEndDate: dates.revisedEndDate || null,
    actualCompletionDate: dates.actualCompletionDate || null,
    defectsLiabilityDays: Number(dates.defectsLiabilityDays),
    timezone: dates.timezone,
  };
}

/**
 * The edit form's steps: the same groups as creation. Party type and
 * workspaces aren't edited here (the API doesn't change them; workspaces
 * have their own controls), so the second step is the parent contract.
 */
export const editContractSteps: Array<{
  id: CreateContractStepId;
  title: string;
}> = [
  { id: "basics", title: "Basics" },
  { id: "parties", title: "Parent contract" },
  { id: "commercial", title: "Commercial terms" },
  { id: "dates", title: "Dates" },
];

/**
 * Whether the contract's value is fixed. The API refuses to change the
 * original value once a contract has left draft; its currency is fixed with
 * it here, so an unchanged amount is never re-read in another currency.
 */
export function isContractValueLocked(contract: Pick<Contract, "status">) {
  return contract.status !== EContractStatus.DRAFT;
}

/** The calendar day of an API date, `YYYY-MM-DD`, or "" for none. */
const calendarDay = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : "";

/**
 * The form's values for an existing contract, so every step opens filled in:
 * amounts in the currency's decimals and percentages as typed. `partyType`
 * is the user's company's party type on it, kept only so the shared schema
 * validates; the edit request never sends it.
 */
export function contractToFormValues(
  contract: Contract,
  partyType: EPartyType,
): CreateContractFormValues {
  const { currencyCode } = contract;
  return {
    basics: {
      referenceNumber: contract.referenceNumber,
      title: contract.title,
      contractType: contract.contractType,
      description: contract.description ?? "",
    },
    parties: {
      partyType,
      parentContractId: contract.parentContractId ?? "",
      workspaces: [],
    },
    commercial: {
      currencyCode,
      originalValue:
        minorToDecimalInput(contract.originalValueMinor, currencyCode) ?? "",
      paymentTermsDays: String(contract.paymentTermsDays),
      retentionRate: basisPointsToPercentInput(contract.retentionRateBps),
      advancePaymentRate:
        contract.advancePaymentRateBps === null
          ? ""
          : basisPointsToPercentInput(contract.advancePaymentRateBps),
      liquidatedDamagesPerDay: contract.liquidatedDamagesPerDayMinor
        ? (minorToDecimalInput(
            contract.liquidatedDamagesPerDayMinor,
            currencyCode,
          ) ?? "")
        : "",
    },
    dates: {
      awardDate: calendarDay(contract.awardDate),
      startDate: calendarDay(contract.startDate),
      endDate: calendarDay(contract.endDate),
      revisedEndDate: calendarDay(contract.revisedEndDate),
      actualCompletionDate: calendarDay(contract.actualCompletionDate),
      defectsLiabilityDays: String(contract.defectsLiabilityDays),
      timezone: contract.timezone,
    },
  };
}

/**
 * The update request for validated edit values: every field the API lets
 * this form change. The reference, party type and workspaces aren't sent;
 * nor are the value and currency once they're locked.
 */
export function toUpdateContractRequest(
  values: CreateContractFormValues,
  { valueLocked }: { valueLocked: boolean },
): Partial<CreateContractRequest> {
  const full = toCreateContractRequest(values);
  // An allowlist: only what the update endpoint changes.
  const request: Partial<CreateContractRequest> = {
    title: full.title,
    description: full.description,
    contractType: full.contractType,
    parentContractId: full.parentContractId,
    retentionRateBps: full.retentionRateBps,
    advancePaymentRateBps: full.advancePaymentRateBps,
    paymentTermsDays: full.paymentTermsDays,
    liquidatedDamagesPerDayMinor: full.liquidatedDamagesPerDayMinor,
    awardDate: full.awardDate,
    startDate: full.startDate,
    endDate: full.endDate,
    revisedEndDate: full.revisedEndDate,
    actualCompletionDate: full.actualCompletionDate,
    defectsLiabilityDays: full.defectsLiabilityDays,
    timezone: full.timezone,
  };
  return valueLocked
    ? request
    : {
        ...request,
        originalValueMinor: full.originalValueMinor,
        currencyCode: full.currencyCode,
      };
}
