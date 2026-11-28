"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  EContractSortField,
  ESortOrder,
  MAX_PAGE_LIMIT,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { RequiredFieldsNote } from "@/components/forms/form-field";
import { FormStepList } from "@/components/forms/form-step-list";
import { useFormSteps, type FormStep } from "@/hooks/use-form-steps";
import { getApiErrorMessage } from "@/lib/apiError";
import { notifySuccess } from "@/lib/notify";
import {
  useCreateContractMutation,
  useGetContractsQuery,
} from "@/services/contractApi";
import { contractSectionHref } from "../contract-sections";
import {
  createContractDefaults,
  createContractFormSchema,
  createContractSteps,
  defaultTimeZone,
  eligibleParentContracts,
  timeZoneOptions,
  toCreateContractRequest,
  type CreateContractFormValues,
} from "../create-contract-schema";
import {
  ContractBasicsFields,
  ContractCommercialFields,
  ContractDatesFields,
  ContractPartiesFields,
} from "./contract-setup-fields";

/** Each step validates its own group of the schema. */
const formSteps: ReadonlyArray<FormStep<CreateContractFormValues>> =
  createContractSteps.map((step) => ({ title: step.title, fields: [step.id] }));

export function CreateContractWizard({
  formId,
  companyId,
  parentContractId,
  onCancel,
  onDirtyChange,
}: {
  formId: string;
  companyId: string;
  /** Starts the form as a subcontract of this main contract. */
  parentContractId?: string;
  /** Leaves the form. The page asks first if anything has been entered. */
  onCancel: () => void;
  /** Called whenever the form gains or loses unsaved input. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const [defaultValues] = useState(() => {
    const values = createContractDefaults(defaultTimeZone(timeZoneOptions()));
    return parentContractId
      ? { ...values, parties: { ...values.parties, parentContractId } }
      : values;
  });
  const form = useForm<CreateContractFormValues>({
    resolver: zodResolver(createContractFormSchema),
    defaultValues,
    // Steps are checked when the user presses Next, not when a field loses
    // focus: an error appearing on blur would push the Next button down
    // between mousedown and mouseup and swallow the click.
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const {
    stepIndex,
    isLastStep,
    stepStatus,
    isStepCompleted,
    formRef,
    headingRef,
    back,
    onSubmit: submitStep,
    ignoreRepeatClick,
  } = useFormSteps({
    form,
    steps: formSteps,
    schema: createContractFormSchema,
    onValid: (values) => create(values),
  });
  const parentContractsQuery = useGetContractsQuery({
    companyId,
    page: 1,
    limit: MAX_PAGE_LIMIT,
    sortBy: EContractSortField.REFERENCE_NUMBER,
    sortOrder: ESortOrder.ASC,
  });
  const [createContract, createState] = useCreateContractMutation();
  const step = createContractSteps[stepIndex];
  const { isDirty } = form.formState;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  async function create(values: CreateContractFormValues) {
    const body = toCreateContractRequest(values);
    const result = await createContract({ companyId, body });
    if ("error" in result) return false;
    notifySuccess(
      "Draft contract created",
      `${body.referenceNumber} · ${body.title} is ready to set up.`,
    );
    // Replaced, not pushed: Back from the new contract returns to the
    // register rather than to an emptied form.
    router.replace(contractSectionHref(result.data.id, "overview"));
    return true;
  }

  return (
    <FormProvider {...form}>
      <form
        ref={formRef}
        id={formId}
        aria-label="New draft contract"
        noValidate
        onSubmit={submitStep}
        className="space-y-6"
      >
        <FormStepList
          steps={createContractSteps}
          stepStatus={stepStatus}
          isStepCompleted={isStepCompleted}
        />

        <div className="space-y-1">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-semibold focus-visible:outline-none"
          ></h2>
          <RequiredFieldsNote />
        </div>

        {step.id === "basics" ? <ContractBasicsFields /> : null}
        {step.id === "parties" ? (
          <ContractPartiesFields
            parentContracts={eligibleParentContracts(
              parentContractsQuery.currentData?.data ?? [],
            )}
            parentContractsLoading={parentContractsQuery.isFetching}
            parentContractsError={parentContractsQuery.error}
          />
        ) : null}
        {step.id === "commercial" ? <ContractCommercialFields /> : null}
        {step.id === "dates" ? <ContractDatesFields /> : null}

        {createState.error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {getApiErrorMessage(
                createState.error,
                "Unable to create the contract.",
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {stepIndex > 0 ? (
              <Button type="button" variant="outline" onClick={back}>
                Back
              </Button>
            ) : null}
            {!isLastStep ? (
              // A submit button, so Enter in any field moves on: browsers
              // submit on Enter only when the form has one. `onSubmit` turns
              // it into Next on every step but the last.
              <Button key="next" type="submit">
                Next: {createContractSteps[stepIndex + 1].title}
              </Button>
            ) : (
              <Button
                key="create"
                type="submit"
                onClick={ignoreRepeatClick}
                disabled={createState.isLoading}
                aria-busy={createState.isLoading || undefined}
              >
                {createState.isLoading ? "Creating…" : "Create draft contract"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
