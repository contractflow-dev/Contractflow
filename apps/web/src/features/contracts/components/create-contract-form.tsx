"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  FormProvider,
  useForm,
  type FieldErrors,
  type FieldPath,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  EContractSortField,
  ESortOrder,
  MAX_PAGE_LIMIT,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { cn } from "@/lib/utils";
import { RequiredFieldsNote } from "@/components/forms/form-field";
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
  timeZoneOptions,
  toCreateContractRequest,
  type CreateContractFormValues,
  type CreateContractStepId,
} from "../create-contract-schema";
import {
  ContractBasicsFields,
  ContractCommercialFields,
  ContractDatesFields,
  ContractPartiesFields,
} from "./contract-setup-fields";

/** Link here to open the form directly: `/dashboards/contracts#new-contract`. */
export const NEW_CONTRACT_ANCHOR = "new-contract";

/**
 * "New contract" for company administrators: a card that opens a four-step
 * form. `canCreate` is the shell's `membership.canManageCompany`; the API
 * makes the same check when the contract is created.
 */
export function CreateContractForm({
  companyId,
  canCreate,
}: {
  companyId: string;
  canCreate: boolean;
}) {
  const [open, setOpen] = useState(false);
  // The Overview's "Create a contract" links here with #new-contract. On a
  // client-side navigation the page renders before the URL changes, so the
  // hash is read just after mounting, and again if it changes later.
  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === `#${NEW_CONTRACT_ANCHOR}`) setOpen(true);
    };
    const pending = window.setTimeout(openFromHash, 0);
    window.addEventListener("hashchange", openFromHash);
    return () => {
      window.clearTimeout(pending);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, []);
  const formId = useId();
  if (!canCreate) return null;

  return (
    <Card id={NEW_CONTRACT_ANCHOR} className="scroll-mt-24">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <div>
          <CardTitle>
            <h2>Contract setup</h2>
          </CardTitle>
          <CardDescription>
            Create a draft contract for this company.
          </CardDescription>
        </div>
        <Button
          type="button"
          aria-expanded={open}
          aria-controls={open ? formId : undefined}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "New contract"}
        </Button>
      </CardHeader>
      {open ? (
        <CardContent>
          {/* Mounted only while open, so each new contract starts afresh. */}
          <CreateContractWizard
            formId={formId}
            companyId={companyId}
            onCancel={() => setOpen(false)}
          />
        </CardContent>
      ) : null}
    </Card>
  );
}

const lastStep = createContractSteps.length - 1;

/** The first step whose fields have an error. */
function firstStepWithErrors(
  errors: FieldErrors<CreateContractFormValues>,
): number {
  const index = createContractSteps.findIndex((step) => errors[step.id]);
  return index === -1 ? 0 : index;
}

export function CreateContractWizard({
  formId,
  companyId,
  onCancel,
}: {
  formId: string;
  companyId: string;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [defaultValues] = useState(() =>
    createContractDefaults(defaultTimeZone(timeZoneOptions())),
  );
  const form = useForm<CreateContractFormValues>({
    resolver: zodResolver(createContractFormSchema),
    defaultValues,
    // Steps are checked when the user presses Next, not when a field loses
    // focus: an error appearing on blur would push the Next button down
    // between mousedown and mouseup and swallow the click.
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const [stepIndex, setStepIndex] = useState(0);
  // Where focus goes once the new step has rendered: its heading when moving
  // between steps, or the first invalid field when a submit fails. The
  // counter re-runs the effect for each request.
  const focusTarget = useRef<"heading" | "error" | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const requestFocus = (target: "heading" | "error") => {
    focusTarget.current = target;
    setFocusRequest((count) => count + 1);
  };
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const parentContractsQuery = useGetContractsQuery({
    companyId,
    page: 1,
    limit: MAX_PAGE_LIMIT,
    sortBy: EContractSortField.REFERENCE_NUMBER,
    sortOrder: ESortOrder.ASC,
  });
  const [createContract, createState] = useCreateContractMutation();
  const step = createContractSteps[stepIndex];

  /**
   * Focuses the first invalid control on screen, in reading order. Reads the
   * form's own field state, which is current as soon as validation returns,
   * rather than waiting for the error attributes to render.
   */
  const focusFirstInvalid = useCallback(() => {
    const controls =
      formRef.current?.querySelectorAll<HTMLElement>("[name]") ?? [];
    for (const control of controls) {
      const name = control.getAttribute("name") as FieldPath<
        CreateContractFormValues
      >;
      if (form.getFieldState(name).invalid) {
        control.focus();
        return;
      }
    }
  }, [form]);

  // Once a step shows errors, re-check it as values change, so each error
  // clears as soon as it is fixed (and amounts follow a currency change).
  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ name }) => {
          const group = name?.split(".")[0] as CreateContractStepId | undefined;
          if (group && form.getFieldState(group).invalid) {
            void form.trigger(group);
          }
        },
      }),
    [form],
  );

  useEffect(() => {
    const target = focusTarget.current;
    focusTarget.current = null;
    if (target === "heading") {
      headingRef.current?.focus();
    } else if (target === "error") {
      focusFirstInvalid();
    }
  }, [focusRequest, focusFirstInvalid, stepIndex]);

  async function next() {
    const valid = await form.trigger(step.id);
    if (!valid) {
      focusFirstInvalid();
      return;
    }
    setStepIndex((index) => Math.min(index + 1, lastStep));
    requestFocus("heading");
  }

  function back() {
    setStepIndex((index) => Math.max(index - 1, 0));
    requestFocus("heading");
  }

  async function create(values: CreateContractFormValues) {
    const body = toCreateContractRequest(values);
    const result = await createContract({ companyId, body });
    if ("error" in result) return;
    notifySuccess(
      "Draft contract created",
      `${body.referenceNumber} · ${body.title} is ready to set up.`,
    );
    router.push(contractSectionHref(result.data.id, "overview"));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    // Enter in a field moves to the next step; only the last step creates.
    if (stepIndex < lastStep) {
      event.preventDefault();
      void next();
      return;
    }
    void form.handleSubmit(create, (errors) => {
      setStepIndex(firstStepWithErrors(errors));
      requestFocus("error");
    })(event);
  }

  return (
    <FormProvider {...form}>
      <form
        ref={formRef}
        id={formId}
        aria-label="New draft contract"
        noValidate
        onSubmit={submit}
        className="space-y-6"
      >
        <ol
          aria-label="Steps"
          className="hidden flex-wrap gap-2 text-sm sm:flex"
        >
          {createContractSteps.map((candidate, index) => (
            <li
              key={candidate.id}
              aria-current={index === stepIndex ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1",
                index === stepIndex
                  ? "border-primary bg-primary/10 font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <span className="tabular-nums" aria-hidden="true">
                {index + 1}
              </span>
              <span>
                {candidate.title}
                {index < stepIndex ? (
                  <span className="sr-only"> (done)</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>

        <div className="space-y-1">
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-semibold focus-visible:outline-none"
          >
            Step {stepIndex + 1} of {createContractSteps.length}: {step.title}
          </h3>
          <RequiredFieldsNote />
        </div>

        {step.id === "basics" ? <ContractBasicsFields /> : null}
        {step.id === "parties" ? (
          <ContractPartiesFields
            parentContracts={parentContractsQuery.currentData?.data ?? []}
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
            {stepIndex < lastStep ? (
              // A submit button, so Enter in any field moves on: browsers
              // submit on Enter only when the form has one. `submit` turns
              // it into Next on every step but the last.
              <Button type="submit">
                Next: {createContractSteps[stepIndex + 1].title}
              </Button>
            ) : (
              <Button
                type="submit"
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
