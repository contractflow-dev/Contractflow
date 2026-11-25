"use client";

import { useId, useMemo, type FocusEvent } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import {
  EContractType,
  ECurrencyCode,
  EPartyType,
} from "@contractflow/contracts-schema";
import { Input } from "@workspace/ui/components/input";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";
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
  currencyDigits,
  formatBasisPoints,
  formatMoneyMinor,
  groupDecimalInput,
  humanizeEnumValue,
  parseDecimalToMinor,
  parsePercentToBasisPoints,
} from "@/lib/format";
import type { Contract } from "@/services/contractApi";
import {
  contractWorkspaces,
  timeZoneOptions,
  type CreateContractFormValues,
} from "../create-contract-schema";

const fieldId = (name: string) => `new-contract-${name}`;

function useCreateContractForm() {
  return useFormContext<CreateContractFormValues>();
}

/** Step 1: what the contract is. */
export function ContractBasicsFields({
  referenceLocked = false,
}: {
  /** Editing: the reference is fixed once the contract exists. */
  referenceLocked?: boolean;
} = {}) {
  const {
    register,
    formState: { errors },
  } = useCreateContractForm();
  const fieldErrors = errors.basics;

  return (
    <FormSection legend="Contract basics">
      <FormGrid columns={2}>
        <FormField
          id={fieldId("referenceNumber")}
          label="Reference number"
          required
          description={
            referenceLocked
              ? "The reference can't change once the contract exists."
              : "Your organization's reference for this contract, up to 40 characters."
          }
          error={fieldErrors?.referenceNumber?.message}
        >
          {(control) => (
            <Input
              {...control}
              {...register("basics.referenceNumber")}
              maxLength={40}
              autoComplete="off"
              readOnly={referenceLocked}
            />
          )}
        </FormField>
        <FormField
          id={fieldId("title")}
          label="Contract title"
          required
          error={fieldErrors?.title?.message}
        >
          {(control) => (
            <Input
              {...control}
              {...register("basics.title")}
              maxLength={255}
              autoComplete="off"
            />
          )}
        </FormField>
        <FormField
          id={fieldId("contractType")}
          label="Contract type"
          required
          error={fieldErrors?.contractType?.message}
        >
          {(control) => (
            <NativeSelect
              {...control}
              {...register("basics.contractType")}
              className="w-full"
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
          {(control) => (
            <Textarea {...control} {...register("basics.description")} />
          )}
        </FormField>
      </FormGrid>
    </FormSection>
  );
}

/**
 * Step 2 of creating a contract: your company's role, any parent contract,
 * and workspaces. None of these change after creation, so editing has no
 * such step.
 */
export function ContractPartiesFields({
  parentContracts,
  parentContractsLoading,
  parentContractsError,
}: {
  parentContracts: Array<Pick<Contract, "id" | "referenceNumber" | "title">>;
  parentContractsLoading: boolean;
  parentContractsError?: unknown;
}) {
  const {
    control: formControl,
    register,
    setValue,
    formState: { errors },
  } = useCreateContractForm();
  const workspaceFieldId = useId();
  const fieldErrors = errors.parties;
  // A subcontract is awarded by your company, so its party type is fixed.
  const isSubcontract = Boolean(
    useWatch({ control: formControl, name: "parties.parentContractId" }),
  );

  return (
    <>
      <FormSection
        legend="Contract parties"
        description="Other companies are invited to the contract after the draft is created."
      >
        <FormGrid columns={2}>
          <FormField
            id={fieldId("partyType")}
            label="Your company's party type"
            required
            description={
              isSubcontract
                ? "Awarding: your company awards this subcontract."
                : "Awarding if your company awards this contract; Awarded if it was awarded to your company."
            }
            error={fieldErrors?.partyType?.message}
          >
            {(control) => (
              <NativeSelect
                {...control}
                {...register("parties.partyType")}
                className="w-full"
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
            description="Choose the main contract if this is a subcontract. Only main contracts awarded to your company, in draft or active, are listed."
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
                {...register("parties.parentContractId", {
                  onChange: (event: { target: { value: string } }) => {
                    if (event.target.value) {
                      setValue("parties.partyType", EPartyType.AWARDING, {
                        shouldDirty: true,
                      });
                    }
                  },
                })}
                className="w-full"
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

      <FormSection
        legend="Workspaces"
        description="Choose the workspaces this contract uses. You can change them later on the contract page."
      >
        <Controller
          control={formControl}
          name="parties.workspaces"
          render={({ field }) => (
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {contractWorkspaces.map((workspace) => {
                const id = `${workspaceFieldId}-${workspace}`;
                return (
                  <Field
                    orientation="horizontal"
                    className="w-fit"
                    key={workspace}
                  >
                    <Checkbox
                      id={id}
                      checked={field.value.includes(workspace)}
                      onCheckedChange={(checked) =>
                        field.onChange(
                          checked
                            ? contractWorkspaces.filter(
                                (candidate) =>
                                  candidate === workspace ||
                                  field.value.includes(candidate),
                              )
                            : field.value.filter(
                                (candidate) => candidate !== workspace,
                              ),
                        )
                      }
                    />
                    <FieldLabel htmlFor={id} className="font-normal">
                      {humanizeEnumValue(workspace)}
                    </FieldLabel>
                  </Field>
                );
              })}
            </div>
          )}
        />
      </FormSection>
    </>
  );
}

/** Step 3: value, currency, payment terms and rates. */
export function ContractCommercialFields({
  valueLocked = false,
}: {
  /**
   * Editing a contract past draft: its original value and currency are
   * fixed (the API refuses to change the value; the currency stays with it).
   */
  valueLocked?: boolean;
} = {}) {
  const {
    control: formControl,
    register,
    setValue,
    formState: { errors },
  } = useCreateContractForm();
  const fieldErrors = errors.commercial;
  const [currencyCode, originalValue, damages, retention, advance] = useWatch({
    control: formControl,
    name: [
      "commercial.currencyCode",
      "commercial.originalValue",
      "commercial.liquidatedDamagesPerDay",
      "commercial.retentionRate",
      "commercial.advancePaymentRate",
    ],
  });

  // Echo what was typed in the currency's own format, so a misplaced
  // decimal point is visible before the contract is saved.
  const amountHint = (typed: string) => {
    const digits = currencyDigits(currencyCode) ?? 2;
    const minor = typed.trim()
      ? parseDecimalToMinor(typed, currencyCode)
      : null;
    const precision =
      digits === 0
        ? `${currencyCode} has no decimal places.`
        : `Up to ${digits} decimal places.`;
    return minor === null
      ? `In ${currencyCode}. ${precision}`
      : `${formatMoneyMinor(minor, currencyCode)}. ${precision}`;
  };
  // Adds grouping commas when the user leaves an amount field ("1500000.5"
  // becomes "1,500,000.5"), not while they type, so the caret never jumps.
  // The amount itself doesn't change.
  const registerAmount = (
    name: "commercial.originalValue" | "commercial.liquidatedDamagesPerDay",
  ) => {
    const field = register(name);
    return {
      ...field,
      onBlur: (event: FocusEvent<HTMLInputElement>) => {
        const grouped = groupDecimalInput(event.target.value);
        if (grouped !== event.target.value) {
          setValue(name, grouped, { shouldDirty: true });
        }
        return field.onBlur(event);
      },
    };
  };
  const percentHint = (typed: string, fallback: string) => {
    const basisPoints = typed.trim() ? parsePercentToBasisPoints(typed) : null;
    return basisPoints === null
      ? fallback
      : `${formatBasisPoints(basisPoints)} (${basisPoints} basis points).`;
  };

  return (
    <FormSection legend="Commercial terms">
      <FormGrid columns={2}>
        <FormField
          id={fieldId("currencyCode")}
          label="Currency"
          required
          description={
            valueLocked
              ? "Fixed with the original value once the contract left draft."
              : undefined
          }
          error={fieldErrors?.currencyCode?.message}
        >
          {(control) =>
            valueLocked ? (
              // Shown, not registered: the form keeps the contract's
              // currency, which the update request then leaves out.
              <Input {...control} value={currencyCode} readOnly />
            ) : (
              <NativeSelect
                {...control}
                {...register("commercial.currencyCode")}
                className="w-full"
              >
                {Object.values(ECurrencyCode).map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {value}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )
          }
        </FormField>
        <FormField
          id={fieldId("originalValue")}
          label="Original contract value"
          required
          description={
            valueLocked
              ? `${amountHint(originalValue)} It can't change once the contract has left draft; approved variations change its current value.`
              : amountHint(originalValue)
          }
          error={fieldErrors?.originalValue?.message}
        >
          {(control) => (
            <Input
              {...control}
              {...registerAmount("commercial.originalValue")}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              readOnly={valueLocked}
            />
          )}
        </FormField>
        <FormField
          id={fieldId("paymentTermsDays")}
          label="Payment terms (days)"
          required
          error={fieldErrors?.paymentTermsDays?.message}
        >
          {(control) => (
            <Input
              {...control}
              {...register("commercial.paymentTermsDays")}
              inputMode="numeric"
              autoComplete="off"
            />
          )}
        </FormField>
        <FormField
          id={fieldId("retentionRate")}
          label="Retention rate (%)"
          required
          description={percentHint(
            retention,
            "Enter 0 if there is no retention.",
          )}
          error={fieldErrors?.retentionRate?.message}
        >
          {(control) => (
            <Input
              {...control}
              {...register("commercial.retentionRate")}
              inputMode="decimal"
              autoComplete="off"
            />
          )}
        </FormField>
        <FormField
          id={fieldId("advancePaymentRate")}
          label="Advance payment rate (%)"
          optional
          description={percentHint(advance, "For example, 10 or 12.5.")}
          error={fieldErrors?.advancePaymentRate?.message}
        >
          {(control) => (
            <Input
              {...control}
              {...register("commercial.advancePaymentRate")}
              inputMode="decimal"
              autoComplete="off"
            />
          )}
        </FormField>
        <FormField
          id={fieldId("liquidatedDamagesPerDay")}
          label="Liquidated damages per day"
          optional
          description={amountHint(damages)}
          error={fieldErrors?.liquidatedDamagesPerDay?.message}
        >
          {(control) => (
            <Input
              {...control}
              {...registerAmount("commercial.liquidatedDamagesPerDay")}
              inputMode="decimal"
              autoComplete="off"
            />
          )}
        </FormField>
      </FormGrid>
    </FormSection>
  );
}

/** Step 4: key dates, defects liability and the contract's time zone. */
export function ContractDatesFields() {
  const {
    register,
    formState: { errors },
  } = useCreateContractForm();
  const fieldErrors = errors.dates;
  const zones = useMemo(() => timeZoneOptions(), []);

  return (
    <FormSection legend="Contract dates and duration">
      <FormGrid columns={2}>
        <FormField
          id={fieldId("awardDate")}
          label="Award date"
          required
          error={fieldErrors?.awardDate?.message}
        >
          {(control) => (
            <Input {...control} {...register("dates.awardDate")} type="date" />
          )}
        </FormField>
        <FormField
          id={fieldId("startDate")}
          label="Start date"
          required
          description="Must not be after the end date."
          error={fieldErrors?.startDate?.message}
        >
          {(control) => (
            <Input {...control} {...register("dates.startDate")} type="date" />
          )}
        </FormField>
        <FormField
          id={fieldId("endDate")}
          label="End date"
          required
          error={fieldErrors?.endDate?.message}
        >
          {(control) => (
            <Input {...control} {...register("dates.endDate")} type="date" />
          )}
        </FormField>
        <FormField
          id={fieldId("revisedEndDate")}
          label="Revised end date"
          optional
          description="Must not be before the end date."
          error={fieldErrors?.revisedEndDate?.message}
        >
          {(control) => (
            <Input
              {...control}
              {...register("dates.revisedEndDate")}
              type="date"
            />
          )}
        </FormField>
        <FormField
          id={fieldId("defectsLiabilityDays")}
          label="Defects liability (days)"
          required
          error={fieldErrors?.defectsLiabilityDays?.message}
        >
          {(control) => (
            <Input
              {...control}
              {...register("dates.defectsLiabilityDays")}
              inputMode="numeric"
              autoComplete="off"
            />
          )}
        </FormField>
        <FormField
          id={fieldId("timezone")}
          label="Contract time zone"
          required
          description="Dates and deadlines for this contract use this time zone."
          error={fieldErrors?.timezone?.message}
          className="sm:col-span-2 lg:col-span-1"
        >
          {(control) => (
            <NativeSelect
              {...control}
              {...register("dates.timezone")}
              className="w-full"
            >
              {zones.map((zone) => (
                <NativeSelectOption key={zone} value={zone}>
                  {zone.replaceAll("_", " ")}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </FormGrid>
    </FormSection>
  );
}
