"use client";

import { useState, type FormEvent } from "react";
import { RiLockLine } from "@remixicon/react";
import type {
  ContractStage,
  CreateMilestoneRequest,
  Milestone,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import {
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  FormField,
  FormGrid,
  FormSection,
  RequiredFieldsNote,
} from "@/components/forms/form-field";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  basisPointsToPercentInput,
  formatCalendarDate,
  minorToDecimalInput,
  parseDecimalToMinor,
  parsePercentToBasisPoints,
} from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import {
  useCreateMilestoneMutation,
  useGetContractStageQuery,
  useGetContractStagesQuery,
  useUpdateMilestoneMutation,
  type UpdateMilestoneRequest,
} from "@/services/deliveryApi";
import {
  asksForDateOverride,
  datesOutsideStage,
  isScopeFrozen,
  isStageClosed,
} from "./project-rules";
import { FormSheet, type ProjectContext } from "./project-ui";

/**
 * Planning a milestone: a new one within a stage (the stage is named by the
 * URL the API is called on, never the body), or changes to an existing one.
 * From the first submission its scope is fixed and only its dates can change.
 */
export function MilestoneSheet({
  project,
  open,
  stage,
  milestone,
  onClose,
}: {
  project: ProjectContext;
  open: boolean;
  /** For a new milestone: its stage, or null to choose one. */
  stage: ContractStage | null;
  /** The milestone to edit; null for a new one. */
  milestone: Milestone | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <FormSheet open={open} busy={busy} onClose={onClose}>
      <MilestoneForm
        key={milestone?.id ?? stage?.id ?? "new"}
        project={project}
        fixedStage={stage}
        milestone={milestone}
        onBusyChange={setBusy}
        onDone={onClose}
      />
    </FormSheet>
  );
}

const SCOPE_NOTICE =
  "Work has been submitted, so the scope is fixed: title, description, acceptance criteria, deliverables, target, weight and payment terms can't change. Only the dates can.";

function MilestoneForm({
  project,
  fixedStage,
  milestone,
  onBusyChange,
  onDone,
}: {
  project: ProjectContext;
  fixedStage: ContractStage | null;
  milestone: Milestone | null;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const { companyId, contractId, contract } = project;
  const frozen = milestone ? isScopeFrozen(milestone) : false;
  const currency = contract.currencyCode;

  const stages = useGetContractStagesQuery(
    { companyId, contractId, page: 1, limit: 100 },
    { skip: !!fixedStage || !!milestone },
  );
  const ownStage = useGetContractStageQuery(
    { companyId, contractId, stageId: milestone?.contractStageId ?? "" },
    { skip: !milestone },
  );
  const openStages = (stages.currentData?.data ?? []).filter(
    (candidate) => !isStageClosed(candidate),
  );
  const [stageId, setStageId] = useState(fixedStage?.id ?? "");
  const stage: ContractStage | null =
    fixedStage ??
    ownStage.currentData ??
    openStages.find((candidate) => candidate.id === stageId) ??
    null;

  const [createMilestone, createState] = useCreateMilestoneMutation();
  const [updateMilestone, updateState] = useUpdateMilestoneMutation();
  const saving = createState.isLoading || updateState.isLoading;
  const apiError = milestone ? updateState.error : createState.error;
  const apiMessage = apiError
    ? getApiErrorMessage(apiError, "Unable to save the milestone.")
    : null;

  const [values, setValues] = useState({
    title: milestone?.title ?? "",
    description: milestone?.description ?? "",
    acceptanceCriteria: milestone?.acceptanceCriteria ?? "",
    deliverables: milestone?.deliverables ?? "",
    weight: milestone ? basisPointsToPercentInput(milestone.weightBps) : "",
    plannedStartDate: milestone?.plannedStartDate ?? "",
    dueDate: milestone?.dueDate ?? "",
    revisedDueDate: milestone?.revisedDueDate ?? "",
    targetQuantity:
      milestone?.targetQuantity != null ? String(milestone.targetQuantity) : "",
    quantityUnit: milestone?.quantityUnit ?? "",
    isPaymentMilestone: milestone?.isPaymentMilestone ?? false,
    amount:
      milestone?.amountMinor != null
        ? (minorToDecimalInput(milestone.amountMinor, currency) ?? "")
        : "",
    dateOverrideReason: "",
  });
  const set = <K extends keyof typeof values>(
    key: K,
    value: (typeof values)[K],
  ) => setValues((current) => ({ ...current, [key]: value }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const datesChanged =
    !milestone ||
    values.plannedStartDate !== (milestone.plannedStartDate ?? "") ||
    values.dueDate !== milestone.dueDate;
  const outside =
    stage && values.dueDate && datesChanged
      ? datesOutsideStage(stage, {
          plannedStartDate: values.plannedStartDate || null,
          dueDate: values.dueDate,
        })
      : [];
  const needsOverride =
    outside.length > 0 || (datesChanged && asksForDateOverride(apiMessage));

  function validate() {
    const next: Record<string, string> = {};
    if (!milestone && !stage) next.stage = "Choose the milestone's stage.";
    if (!frozen) {
      if (!values.title.trim()) next.title = "Enter the milestone's title.";
      if (parsePercentToBasisPoints(values.weight) === null) {
        next.weight =
          "Enter a share between 0 and 100, with up to two decimals.";
      }
      const target = values.targetQuantity.trim();
      if (target && !/^[1-9]\d{0,9}$/.test(target)) {
        next.targetQuantity = "Enter a whole number above 0.";
      }
      if (values.quantityUnit.trim() && !target) {
        next.targetQuantity = "A unit needs a target quantity.";
      }
      if (values.isPaymentMilestone) {
        if (!values.amount.trim()) {
          next.amount = "A payment milestone needs its amount.";
        } else if (!parseDecimalToMinor(values.amount, currency)) {
          next.amount = `Enter an amount in ${currency}.`;
        }
      }
    }
    if (!values.dueDate) next.dueDate = "Choose the due date.";
    if (
      values.plannedStartDate &&
      values.dueDate &&
      values.dueDate < values.plannedStartDate
    ) {
      next.dueDate = "The due date can't be before the planned start.";
    }
    if (
      values.revisedDueDate &&
      values.dueDate &&
      values.revisedDueDate < values.dueDate
    ) {
      next.revisedDueDate =
        "The revised due date can't be before the original due date.";
    }
    if (needsOverride && !values.dateOverrideReason.trim()) {
      next.dateOverrideReason =
        "Explain why the milestone's dates fall outside its stage's.";
    }
    return next;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    const target = values.targetQuantity.trim();
    const scope = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      acceptanceCriteria: values.acceptanceCriteria.trim() || null,
      deliverables: values.deliverables.trim() || null,
      weightBps: parsePercentToBasisPoints(values.weight) ?? 0,
      targetQuantity: target ? Number(target) : null,
      quantityUnit: target ? values.quantityUnit.trim() || null : null,
      isPaymentMilestone: values.isPaymentMilestone,
      amountMinor: values.isPaymentMilestone
        ? parseDecimalToMinor(values.amount, currency)
        : null,
    };
    const override = needsOverride
      ? { dateOverrideReason: values.dateOverrideReason.trim() }
      : {};

    onBusyChange(true);
    let result;
    if (milestone) {
      // Only changed fields; scope fields never once the scope is fixed.
      const body: UpdateMilestoneRequest = {};
      if (!frozen) {
        for (const key of Object.keys(scope) as Array<keyof typeof scope>) {
          if (scope[key] !== milestone[key]) {
            (body as Record<string, unknown>)[key] = scope[key];
          }
        }
      }
      const start = values.plannedStartDate || null;
      if (start !== milestone.plannedStartDate) body.plannedStartDate = start;
      if (values.dueDate !== milestone.dueDate) body.dueDate = values.dueDate;
      const revised = values.revisedDueDate || null;
      if (revised !== milestone.revisedDueDate) body.revisedDueDate = revised;
      if (!Object.keys(body).length) {
        onBusyChange(false);
        onDone();
        return;
      }
      result = await updateMilestone({
        companyId,
        contractId,
        milestoneId: milestone.id,
        body: { ...body, ...override },
      });
    } else {
      const body: CreateMilestoneRequest = {
        ...scope,
        plannedStartDate: values.plannedStartDate || null,
        dueDate: values.dueDate,
        ...override,
      };
      result = await createMilestone({
        companyId,
        contractId,
        stageId: stage!.id,
        body,
      });
    }
    onBusyChange(false);
    if (!("error" in result)) {
      notifySuccess(
        milestone ? "Milestone updated" : "Milestone added",
        milestone?.title ?? scope.title,
      );
      onDone();
    }
  }

  const id = milestone ? `milestone-${milestone.id}` : "milestone-new";
  const title = milestone ? `Edit ${milestone.title}` : "Add a milestone";
  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex min-h-full flex-col"
      aria-label={title}
    >
      <SheetHeader className="border-b">
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>
          {stage
            ? `Stage ${stage.sequence}: ${stage.name}, planned ${formatCalendarDate(stage.plannedStartDate)} – ${formatCalendarDate(stage.plannedEndDate)}.`
            : "Each milestone belongs to a stage and is planned within its dates."}
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-6 p-4">
        <RequiredFieldsNote />
        {frozen ? (
          <Alert>
            <RiLockLine aria-hidden="true" />
            <AlertDescription>{SCOPE_NOTICE}</AlertDescription>
          </Alert>
        ) : null}

        {!milestone && !fixedStage ? (
          <FormField
            id={`${id}-stage`}
            label="Stage"
            required
            error={errors.stage}
          >
            {(control) => (
              <NativeSelect
                {...control}
                className="w-full"
                value={stageId}
                onChange={(event) => setStageId(event.target.value)}
              >
                <NativeSelectOption value="">Choose a stage</NativeSelectOption>
                {openStages.map((candidate) => (
                  <NativeSelectOption key={candidate.id} value={candidate.id}>
                    {candidate.sequence}. {candidate.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
        ) : null}

        <FormSection legend="Scope">
          <FormGrid columns={1}>
            <FormField
              id={`${id}-title`}
              label="Title"
              required
              error={errors.title}
            >
              {(control) => (
                <Input
                  {...control}
                  value={values.title}
                  maxLength={255}
                  disabled={frozen}
                  onChange={(event) => set("title", event.target.value)}
                />
              )}
            </FormField>
            {(
              [
                ["description", "Description"],
                ["acceptanceCriteria", "Acceptance criteria"],
                ["deliverables", "Deliverables"],
              ] as const
            ).map(([key, label]) => (
              <FormField
                key={key}
                id={`${id}-${key}`}
                label={label}
                optional
                description={
                  key === "acceptanceCriteria"
                    ? "What the client will check before accepting the milestone."
                    : undefined
                }
              >
                {(control) => (
                  <Textarea
                    {...control}
                    value={values[key]}
                    maxLength={5000}
                    rows={3}
                    disabled={frozen}
                    onChange={(event) => set(key, event.target.value)}
                  />
                )}
              </FormField>
            ))}
            <FormField
              id={`${id}-weight`}
              label="Share of the stage (%)"
              required
              error={errors.weight}
              description="A stage's milestones together can add up to 100% at most."
            >
              {(control) => (
                <Input
                  {...control}
                  value={values.weight}
                  inputMode="decimal"
                  disabled={frozen}
                  onChange={(event) => set("weight", event.target.value)}
                />
              )}
            </FormField>
          </FormGrid>
          <FormGrid columns={2}>
            <FormField
              id={`${id}-target`}
              label="Target quantity"
              optional
              error={errors.targetQuantity}
              description="A measurable target, such as 100."
            >
              {(control) => (
                <Input
                  {...control}
                  value={values.targetQuantity}
                  inputMode="numeric"
                  disabled={frozen}
                  onChange={(event) =>
                    set("targetQuantity", event.target.value)
                  }
                />
              )}
            </FormField>
            <FormField
              id={`${id}-unit`}
              label="Unit"
              optional
              description="Such as streetlights or metres."
            >
              {(control) => (
                <Input
                  {...control}
                  value={values.quantityUnit}
                  maxLength={40}
                  disabled={frozen}
                  onChange={(event) => set("quantityUnit", event.target.value)}
                />
              )}
            </FormField>
          </FormGrid>
          <label
            htmlFor={`${id}-payment`}
            className="flex items-start gap-3 rounded-lg border p-3 text-sm"
          >
            <Checkbox
              id={`${id}-payment`}
              checked={values.isPaymentMilestone}
              disabled={frozen}
              onCheckedChange={(checked) =>
                set("isPaymentMilestone", checked === true)
              }
            />
            <span className="space-y-1">
              <span className="block font-medium">Payment milestone</span>
              <span className="block text-muted-foreground">
                An amount is agreed for it. Approval doesn&apos;t invoice or pay it:
                that follows the finance workflow.
              </span>
            </span>
          </label>
          {values.isPaymentMilestone ? (
            <FormField
              id={`${id}-amount`}
              label={`Amount (${currency})`}
              required
              error={errors.amount}
            >
              {(control) => (
                <Input
                  {...control}
                  value={values.amount}
                  inputMode="decimal"
                  disabled={frozen}
                  onChange={(event) => set("amount", event.target.value)}
                />
              )}
            </FormField>
          ) : null}
        </FormSection>

        <FormSection
          legend="Dates"
          description={
            stage
              ? `Within the stage's planned dates, ${formatCalendarDate(stage.plannedStartDate)} – ${formatCalendarDate(stage.plannedEndDate)}.`
              : undefined
          }
        >
          <FormGrid columns={2}>
            <FormField id={`${id}-start`} label="Planned start" optional>
              {(control) => (
                <Input
                  {...control}
                  type="date"
                  value={values.plannedStartDate}
                  onChange={(event) =>
                    set("plannedStartDate", event.target.value)
                  }
                />
              )}
            </FormField>
            <FormField
              id={`${id}-due`}
              label="Due date"
              required
              error={errors.dueDate}
            >
              {(control) => (
                <Input
                  {...control}
                  type="date"
                  value={values.dueDate}
                  onChange={(event) => set("dueDate", event.target.value)}
                />
              )}
            </FormField>
            {milestone ? (
              <FormField
                id={`${id}-revised`}
                label="Revised due date"
                optional
                error={errors.revisedDueDate}
                description="Records a slip; the original due date is kept."
              >
                {(control) => (
                  <Input
                    {...control}
                    type="date"
                    value={values.revisedDueDate}
                    min={values.dueDate || undefined}
                    onChange={(event) =>
                      set("revisedDueDate", event.target.value)
                    }
                  />
                )}
              </FormField>
            ) : null}
          </FormGrid>
          {needsOverride ? (
            <div className="space-y-3 rounded-xl border bg-warning-soft p-4 text-warning-soft-foreground">
              <p className="text-sm">
                {outside.length
                  ? `The milestone's ${outside
                      .map((field) =>
                        field === "dueDate" ? "due date" : "planned start",
                      )
                      .join(
                        " and ",
                      )} ${outside.length > 1 ? "fall" : "falls"} outside its stage's planned dates.`
                  : "These dates fall outside the stage's planned dates."}{" "}
                Give a reason to plan it this way anyway; it is recorded in the
                activity.
              </p>
              <FormField
                id={`${id}-override`}
                label="Date override reason"
                required
                error={errors.dateOverrideReason}
              >
                {(control) => (
                  <Textarea
                    {...control}
                    value={values.dateOverrideReason}
                    maxLength={2000}
                    rows={2}
                    onChange={(event) =>
                      set("dateOverrideReason", event.target.value)
                    }
                  />
                )}
              </FormField>
            </div>
          ) : null}
        </FormSection>

        {apiMessage ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{apiMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>
      <SheetFooter className="sticky bottom-0 flex-row justify-end gap-2 border-t bg-popover">
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving} aria-busy={saving || undefined}>
          {saving ? "Saving…" : milestone ? "Save milestone" : "Add milestone"}
        </Button>
      </SheetFooter>
    </form>
  );
}
