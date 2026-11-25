"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  ContractRelationSummary,
  EPartyType,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { RequiredFieldsNote } from "@/components/forms/form-field";
import { FormStepList } from "@/components/forms/form-step-list";
import { useFormSteps, type FormStep } from "@/hooks/use-form-steps";
import { getApiErrorMessage } from "@/lib/apiError";
import { notifySuccess } from "@/lib/notify";
import {
  useUpdateContractMutation,
  type Contract,
} from "@/services/contractApi";
import { contractSectionHref } from "../contract-sections";
import {
  contractToFormValues,
  createContractFormSchema,
  editContractSteps,
  isContractValueLocked,
  toUpdateContractRequest,
  type CreateContractFormValues,
} from "../create-contract-schema";
import {
  ContractBasicsFields,
  ContractCommercialFields,
  ContractDatesFields,
} from "./contract-setup-fields";
import { ParentContractLine } from "./related-contracts";

/** Each step validates its own group of the schema, as on creation. */
const formSteps: ReadonlyArray<FormStep<CreateContractFormValues>> =
  editContractSteps.map((step) => ({ title: step.title, fields: [step.id] }));

/**
 * The contract's details in the New contract steps, filled in from the
 * contract. Only what the update endpoint changes is sent; the API decides
 * who may edit and still checks every rule.
 */
export function EditContractWizard({
  formId,
  companyId,
  contract,
  partyType,
  parentContract = null,
  onCancel,
  onDirtyChange,
}: {
  formId: string;
  companyId: string;
  contract: Contract;
  /** The company's party type on the contract, for the shared schema. */
  partyType: EPartyType;
  /** A subcontract's main contract, when the reader may open it. */
  parentContract?: ContractRelationSummary | null;
  /** Leaves the form. The page asks first if anything has changed. */
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const valueLocked = isContractValueLocked(contract);
  const [defaultValues] = useState(() =>
    contractToFormValues(contract, partyType),
  );
  const form = useForm<CreateContractFormValues>({
    resolver: zodResolver(createContractFormSchema),
    defaultValues,
    // As on creation: each step is checked on Next, not on blur.
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
    onValid: (values) => save(values),
  });
  const [updateContract, updateState] = useUpdateContractMutation();
  const step = editContractSteps[stepIndex];
  const { isDirty } = form.formState;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  async function save(values: CreateContractFormValues) {
    const body = toUpdateContractRequest(values, { valueLocked });
    const result = await updateContract({
      companyId,
      contractId: contract.id,
      body,
    });
    if ("error" in result) return false;
    notifySuccess(
      "Contract updated",
      `${contract.referenceNumber} · ${body.title ?? contract.title} is saved.`,
    );
    // Replaced, not pushed: Back from the contract doesn't reopen the form.
    router.replace(contractSectionHref(contract.id, "overview"));
    return true;
  }

  return (
    <FormProvider {...form}>
      <form
        ref={formRef}
        id={formId}
        aria-label={`Edit ${contract.referenceNumber}`}
        noValidate
        onSubmit={submitStep}
        className="space-y-6"
      >
        <FormStepList
          steps={editContractSteps}
          stepStatus={stepStatus}
          isStepCompleted={isStepCompleted}
        />

        <div className="space-y-1">
          <RequiredFieldsNote />
          {/* Context only: the parent is set when a subcontract is created. */}
          <ParentContractLine
            parentContractId={contract.parentContractId}
            parentContract={parentContract}
          />
        </div>

        {step.id === "basics" ? <ContractBasicsFields referenceLocked /> : null}
        {step.id === "commercial" ? (
          <ContractCommercialFields valueLocked={valueLocked} />
        ) : null}
        {step.id === "dates" ? <ContractDatesFields /> : null}

        {updateState.error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {getApiErrorMessage(
                updateState.error,
                "Unable to save the contract.",
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
              // A submit button, so Enter in any field moves on.
              <Button key="next" type="submit">
                Next: {editContractSteps[stepIndex + 1].title}
              </Button>
            ) : (
              <Button
                key="save"
                type="submit"
                onClick={ignoreRepeatClick}
                disabled={updateState.isLoading}
                aria-busy={updateState.isLoading || undefined}
              >
                {updateState.isLoading ? "Saving…" : "Save changes"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
