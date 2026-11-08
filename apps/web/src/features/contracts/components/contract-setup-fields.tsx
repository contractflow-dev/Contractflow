"use client";

import { useState } from "react";
import {
  EContractType,
  ECurrencyCode,
  EPartyType,
} from "@contractflow/contracts-schema";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  FormField,
  FormGrid,
  FormSection,
} from "@/components/forms/form-field";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  formatBasisPoints,
  formatMoneyMinor,
  humanizeEnumValue,
} from "@/lib/format";
import type {
  AssignableContractWorkspace,
  Contract,
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

const fieldId = (name: string) => `new-contract-${name}`;

/** A whole number of minor units as typed, or null while incomplete. */
function wholeNumber(value: string): number | null {
  return /^\d+$/.test(value.trim()) ? Number(value) : null;
}

/**
 * The fields of the new-contract form, grouped by what they describe. The
 * form reads them with `FormData`, so each control keeps its `name`.
 */
export function ContractSetupFields({
  parentContracts,
  parentContractsLoading,
  parentContractsError,
  dateErrors = {},
}: {
  parentContracts: Array<Pick<Contract, "id" | "referenceNumber" | "title">>;
  parentContractsLoading: boolean;
  parentContractsError?: unknown;
  dateErrors?: ContractDateErrors;
}) {
  // Tracked only to explain amounts as they are typed; the form still reads
  // the submitted values from the inputs.
  const [currencyCode, setCurrencyCode] = useState<string>(ECurrencyCode.USD);
  const [valueMinor, setValueMinor] = useState("");
  const [damagesMinor, setDamagesMinor] = useState("");
  const [retentionBps, setRetentionBps] = useState("0");
  const [advanceBps, setAdvanceBps] = useState("");

  const minorUnitsHint = (typed: string) => {
    const amount = wholeNumber(typed);
    return amount === null
      ? `In minor units, the currency's smallest unit. For example, 150000 is ${formatMoneyMinor(150000, currencyCode)}.`
      : `In minor units. ${typed.trim()} is ${formatMoneyMinor(amount, currencyCode)}.`;
  };
  const basisPointsHint = (typed: string) => {
    const bps = wholeNumber(typed);
    return bps === null || bps > 10_000
      ? "100 basis points equal 1%. Enter 0 to 10,000."
      : `100 basis points equal 1%. ${typed.trim()} is ${formatBasisPoints(bps)}.`;
  };

  return (
    <>
      <FormSection legend="Contract overview">
        <FormGrid columns={2}>
          <FormField
            id={fieldId("referenceNumber")}
            label="Reference number"
            required
            description="Your organization's reference for this contract, up to 40 characters."
          >
            {(control) => (
              <Input
                {...control}
                name="referenceNumber"
                required
                maxLength={40}
              />
            )}
          </FormField>
          <FormField id={fieldId("title")} label="Contract title" required>
            {(control) => (
              <Input {...control} name="title" required maxLength={255} />
            )}
          </FormField>
          <FormField id={fieldId("contractType")} label="Contract type" required>
            {(control) => (
              <NativeSelect
                {...control}
                name="contractType"
                className="w-full"
                defaultValue={Object.values(EContractType)[0]}
              >
                {Object.values(EContractType).map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {humanizeEnumValue(value)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField
            id={fieldId("description")}
            label="Description"
            optional
            className="sm:col-span-2"
          >
            {(control) => <Textarea {...control} name="description" />}
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection
        legend="Contract parties"
        description="Other companies are invited to the contract after the draft is created."
      >
        <FormGrid columns={2}>
          <FormField
            id={fieldId("partyType")}
            label="Your company's party type"
            required
            description="The role your company has in this contract."
          >
            {(control) => (
              <NativeSelect
                {...control}
                name="partyType"
                className="w-full"
                defaultValue={Object.values(EPartyType)[0]}
              >
                {Object.values(EPartyType).map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {humanizeEnumValue(value)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField
            id={fieldId("parentContractId")}
            label="Parent contract"
            optional
            description="Choose the main contract if this is a subcontract."
            error={
              parentContractsError
                ? getApiErrorMessage(
                    parentContractsError,
                    "Unable to load existing contracts.",
                  )
                : undefined
            }
          >
            {(control) => (
              <NativeSelect
                {...control}
                name="parentContractId"
                className="w-full"
                defaultValue=""
                disabled={parentContractsLoading}
                aria-busy={parentContractsLoading || undefined}
              >
                <NativeSelectOption value="">
                  None — standalone contract
                </NativeSelectOption>
                {parentContracts.map((parent) => (
                  <NativeSelectOption key={parent.id} value={parent.id}>
                    {parent.referenceNumber} · {parent.title}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection legend="Commercial terms">
        <FormGrid columns={3}>
          <FormField
            id={fieldId("originalValueMinor")}
            label="Original contract value"
            required
            description={minorUnitsHint(valueMinor)}
          >
            {(control) => (
              <Input
                {...control}
                name="originalValueMinor"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                required
                onChange={(event) => setValueMinor(event.target.value)}
              />
            )}
          </FormField>
          <FormField id={fieldId("currencyCode")} label="Currency" required>
            {(control) => (
              <NativeSelect
                {...control}
                name="currencyCode"
                className="w-full"
                defaultValue={ECurrencyCode.USD}
                onChange={(event) => setCurrencyCode(event.target.value)}
              >
                {Object.values(ECurrencyCode).map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {value}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField
            id={fieldId("paymentTermsDays")}
            label="Payment terms (days)"
            required
          >
            {(control) => (
              <Input
                {...control}
                name="paymentTermsDays"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                defaultValue="30"
                required
              />
            )}
          </FormField>
          <FormField
            id={fieldId("retentionRateBps")}
            label="Retention rate (basis points)"
            required
            description={basisPointsHint(retentionBps)}
          >
            {(control) => (
              <Input
                {...control}
                name="retentionRateBps"
                type="number"
                inputMode="numeric"
                min="0"
                max="10000"
                step="1"
                defaultValue="0"
                required
                onChange={(event) => setRetentionBps(event.target.value)}
              />
            )}
          </FormField>
          <FormField
            id={fieldId("advancePaymentRateBps")}
            label="Advance payment rate (basis points)"
            optional
            description={basisPointsHint(advanceBps)}
          >
            {(control) => (
              <Input
                {...control}
                name="advancePaymentRateBps"
                type="number"
                inputMode="numeric"
                min="0"
                max="10000"
                step="1"
                onChange={(event) => setAdvanceBps(event.target.value)}
              />
            )}
          </FormField>
          <FormField
            id={fieldId("liquidatedDamagesPerDayMinor")}
            label="Liquidated damages per day"
            optional
            description={minorUnitsHint(damagesMinor)}
          >
            {(control) => (
              <Input
                {...control}
                name="liquidatedDamagesPerDayMinor"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                onChange={(event) => setDamagesMinor(event.target.value)}
              />
            )}
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection legend="Contract dates and duration">
        <FormGrid columns={3}>
          <FormField id={fieldId("awardDate")} label="Award date" required>
            {(control) => (
              <Input {...control} name="awardDate" type="date" required />
            )}
          </FormField>
          <FormField
            id={fieldId("startDate")}
            label="Start date"
            required
            description="Must not be after the end date."
            error={dateErrors.startDate}
          >
            {(control) => (
              <Input {...control} name="startDate" type="date" required />
            )}
          </FormField>
          <FormField id={fieldId("endDate")} label="End date" required>
            {(control) => (
              <Input {...control} name="endDate" type="date" required />
            )}
          </FormField>
          <FormField
            id={fieldId("revisedEndDate")}
            label="Revised end date"
            optional
            description="Must not be before the end date."
            error={dateErrors.revisedEndDate}
          >
            {(control) => (
              <Input {...control} name="revisedEndDate" type="date" />
            )}
          </FormField>
          <FormField
            id={fieldId("actualCompletionDate")}
            label="Actual completion date"
            optional
            description="Must not be before the start date."
            error={dateErrors.actualCompletionDate}
          >
            {(control) => (
              <Input {...control} name="actualCompletionDate" type="date" />
            )}
          </FormField>
          <FormField
            id={fieldId("defectsLiabilityDays")}
            label="Defects liability (days)"
            required
          >
            {(control) => (
              <Input
                {...control}
                name="defectsLiabilityDays"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                defaultValue="0"
                required
              />
            )}
          </FormField>
          <FormField
            id={fieldId("timezone")}
            label="Contract time zone"
            required
            description="An IANA time zone name, such as UTC or Africa/Lagos."
          >
            {(control) => (
              <Input
                {...control}
                name="timezone"
                defaultValue="UTC"
                required
                maxLength={64}
                autoCapitalize="off"
                spellCheck={false}
              />
            )}
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection
        legend="Workspaces"
        description="Choose the workspaces this contract uses. You can change them later on the contract page."
      >
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {contractWorkspaces.map((workspace) => (
            <label
              className="flex min-h-6 items-center gap-2 text-sm"
              key={workspace}
            >
              <input
                type="checkbox"
                name="workspaces"
                value={workspace}
                defaultChecked
                className="size-4 accent-primary"
              />
              {humanizeEnumValue(workspace)}
            </label>
          ))}
        </div>
      </FormSection>
    </>
  );
}
