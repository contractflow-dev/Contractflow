"use client";

import { useState, type FormEvent } from "react";
import { RiAddLine } from "@remixicon/react";
import {
  EContractStatus,
  EMilestoneStatus,
  EStatus,
  type ContractStage,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenuItem } from "@workspace/ui/components/dropdown-menu";
import { Input } from "@workspace/ui/components/input";
import {
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import { Textarea } from "@workspace/ui/components/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import {
  DataTable,
  DataTableEmpty,
  DataTableRowActions,
  type DataTableColumn,
} from "@/components/data-table/data-table";
import { ListCard } from "@/components/data-table/list-card";
import {
  FormField,
  FormGrid,
  FormSection,
  RequiredFieldsNote,
} from "@/components/forms/form-field";
import { StatusBadge } from "@/components/status-badge/status-badge";
import { useKeepPageInRange, usePagination } from "@/hooks/use-pagination";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  basisPointsToPercentInput,
  formatBasisPoints,
  formatCalendarDate,
  formatNumber,
  parsePercentToBasisPoints,
} from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import {
  useCreateContractStageMutation,
  useGetContractStagesQuery,
  useGetMilestonesQuery,
  useSetContractStageApplicabilityMutation,
  useTransitionContractStageMutation,
  useUpdateContractStageMutation,
  type UpdateContractStageRequest,
} from "@/services/deliveryApi";
import { MilestoneSheet } from "./milestone-form";
import {
  STAGE_TRANSITIONS,
  asksForDateOverride,
  isStageClosed,
  milestonesOutsideDates,
  stageOpen,
  stageTransitions,
  type StageTransition,
} from "./project-rules";
import {
  BpsMeter,
  DayRange,
  FormSheet,
  ProjectStatusNotice,
  type ProjectContext,
} from "./project-ui";

/**
 * The contract's stages, in order. The Client Project Manager plans them
 * (while the contract is a draft or active) and moves them through their
 * statuses (while it is active); everyone in the Project workspace reads them.
 */
export function ProjectStages({ project }: { project: ProjectContext }) {
  const { companyId, contractId, permissions, contract } = project;
  const pagination = usePagination(20);
  const stages = useGetContractStagesQuery({
    companyId,
    contractId,
    page: pagination.page,
    limit: pagination.limit,
  });
  useKeepPageInRange(stages.currentData?.meta, pagination.setPage);
  const [editing, setEditing] = useState<ContractStage | "new" | null>(null);
  const [addingTo, setAddingTo] = useState<ContractStage | null>(null);
  const [moving, setMoving] = useState<{
    stage: ContractStage;
    transition: StageTransition;
  } | null>(null);
  const [deciding, setDeciding] = useState<ContractStage | null>(null);

  const rows = stages.currentData?.data ?? [];
  const allLoaded =
    !!stages.currentData && stages.currentData.meta.totalItems === rows.length;
  // Stages that don't apply or were cancelled count for nothing.
  const appliedWeight = rows
    .filter(
      (stage) =>
        stage.isApplicable !== false && stage.status !== EStatus.CANCELLED,
    )
    .reduce((sum, stage) => sum + stage.weightBps, 0);

  const columns: ReadonlyArray<DataTableColumn<ContractStage>> = [
    {
      id: "stage",
      header: "Stage",
      wrap: true,
      className: "min-w-48",
      cell: (stage) => (
        <>
          <span className="block font-medium">
            {stage.sequence}. {stage.name}
          </span>
          {stage.description ? (
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {stage.description}
            </span>
          ) : null}
          {stage.isApplicable === false ? (
            <span className="block text-xs text-muted-foreground">
              Doesn&apos;t apply
              {stage.applicabilityReason
                ? `: ${stage.applicabilityReason}`
                : ""}
            </span>
          ) : null}
        </>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (stage) => <StatusBadge status={stage.status} />,
    },
    {
      id: "planned",
      header: "Planned",
      hideBelow: "lg",
      cell: (stage) => (
        <DayRange from={stage.plannedStartDate} to={stage.plannedEndDate} />
      ),
    },
    {
      id: "actual",
      header: "Actual",
      hideBelow: "lg",
      cell: (stage) => (
        <DayRange from={stage.actualStartDate} to={stage.actualEndDate} />
      ),
    },
    {
      id: "progress",
      header: "Approved progress",
      cell: (stage) => (
        <BpsMeter
          value={stage.progressBps}
          label="Approved progress"
          hideLabel
        />
      ),
    },
    {
      id: "weight",
      header: "Weight",
      numeric: true,
      hideBelow: "md",
      cell: (stage) => formatBasisPoints(stage.weightBps),
    },
    {
      id: "milestones",
      header: "Milestones",
      numeric: true,
      hideBelow: "md",
      cell: (stage) => <StageMilestoneCounts project={project} stage={stage} />,
    },
  ];

  const canChange = permissions.canPlan || permissions.canOperateAsPlanner;

  return (
    <div className="space-y-4">
      <ProjectStatusNotice notice={permissions.statusNotice} />
      <ListCard
        title="Stages"
        description={
          allLoaded && rows.length
            ? `The contract's phases in order. The stages that apply add up to ${formatBasisPoints(appliedWeight)} of the contract${contract.lifecycleTemplateVersionId && contract.status === EContractStatus.DRAFT ? "; they must total 100% before the contract is activated" : ""}.`
            : "The contract's phases in order, each with its share of the contract and its milestones."
        }
        action={
          permissions.canPlan && permissions.canChangePlan ? (
            <Button type="button" onClick={() => setEditing("new")}>
              <RiAddLine aria-hidden="true" data-icon="inline-start" />
              Add stage
            </Button>
          ) : null
        }
      >
        <DataTable
          label="Stages"
          columns={columns}
          rows={rows}
          getRowKey={(stage) => stage.id}
          isLoading={stages.isLoading}
          loadingLabel="Loading stages…"
          error={
            stages.error
              ? getApiErrorMessage(stages.error, "Unable to load the stages.")
              : null
          }
          onRetry={() => void stages.refetch()}
          rowActions={
            canChange
              ? (stage) => {
                  // During defects liability only stage 9 changes (D-12).
                  const open = stageOpen(contract.status, stage);
                  const applies = stage.isApplicable !== false;
                  const planning =
                    permissions.canPlan &&
                    open &&
                    applies &&
                    !isStageClosed(stage);
                  const moves =
                    permissions.canOperateAsPlanner && open && applies
                      ? stageTransitions(stage.status)
                      : [];
                  // Whether it applies is decided while it hasn't started.
                  const decide =
                    permissions.canPlan &&
                    open &&
                    stage.status === EStatus.PLANNED;
                  if (!planning && !moves.length && !decide) return null;
                  return (
                    <DataTableRowActions
                      label={`Actions for stage ${stage.name}`}
                    >
                      {planning ? (
                        <>
                          <DropdownMenuItem onClick={() => setEditing(stage)}>
                            Edit stage
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAddingTo(stage)}>
                            Add milestone
                          </DropdownMenuItem>
                        </>
                      ) : null}
                      {moves.map((transition) => (
                        <DropdownMenuItem
                          key={transition}
                          onClick={() => setMoving({ stage, transition })}
                        >
                          {STAGE_TRANSITIONS[transition].label}
                        </DropdownMenuItem>
                      ))}
                      {decide ? (
                        <DropdownMenuItem onClick={() => setDeciding(stage)}>
                          {applies ? "Mark as not applying" : "Reinstate stage"}
                        </DropdownMenuItem>
                      ) : null}
                    </DataTableRowActions>
                  );
                }
              : undefined
          }
          empty={
            <DataTableEmpty
              title="No stages yet"
              description={
                permissions.canPlan
                  ? "Add the contract's first stage, then plan its milestones."
                  : "The client's Client Project Manager plans the contract's stages."
              }
            />
          }
          pagination={
            stages.currentData
              ? {
                  meta: stages.currentData.meta,
                  itemLabel: "stages",
                  isFetching: stages.isFetching,
                  onPageChange: pagination.setPage,
                  onPageSizeChange: pagination.setLimit,
                }
              : undefined
          }
        />
      </ListCard>

      <FormSheet open={editing !== null} onClose={() => setEditing(null)}>
        {editing !== null ? (
          <StageForm
            key={editing === "new" ? "new" : editing.id}
            project={project}
            stage={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </FormSheet>

      <MilestoneSheet
        project={project}
        open={addingTo !== null}
        stage={addingTo}
        milestone={null}
        onClose={() => setAddingTo(null)}
      />

      {deciding ? (
        <StageApplicabilityDialog
          key={deciding.id}
          project={project}
          stage={deciding}
          onClose={() => setDeciding(null)}
        />
      ) : null}

      {moving ? (
        <StageTransitionDialog
          key={`${moving.stage.id}-${moving.transition}`}
          project={project}
          stage={moving.stage}
          transition={moving.transition}
          onClose={() => setMoving(null)}
        />
      ) : null}
    </div>
  );
}

/** The stage's milestones and how many are approved, from the API's totals. */
function StageMilestoneCounts({
  project,
  stage,
}: {
  project: ProjectContext;
  stage: ContractStage;
}) {
  const scope = {
    companyId: project.companyId,
    contractId: project.contractId,
    contractStageId: stage.id,
    page: 1,
    limit: 1,
  };
  const all = useGetMilestonesQuery(scope);
  const approved = useGetMilestonesQuery({
    ...scope,
    status: EMilestoneStatus.APPROVED,
  });
  const total = all.currentData?.meta.totalItems;
  const done = approved.currentData?.meta.totalItems;
  if (total === undefined || done === undefined) {
    return <span className="text-muted-foreground">…</span>;
  }
  return (
    <span>
      {formatNumber(done)} of {formatNumber(total)}
      <span className="sr-only"> approved</span>
    </span>
  );
}

function StageForm({
  project,
  stage,
  onDone,
}: {
  project: ProjectContext;
  stage: ContractStage | null;
  onDone: () => void;
}) {
  const { companyId, contractId } = project;
  const [createStage, createState] = useCreateContractStageMutation();
  const [updateStage, updateState] = useUpdateContractStageMutation();
  const saving = createState.isLoading || updateState.isLoading;
  const apiError = stage ? updateState.error : createState.error;
  const apiMessage = apiError
    ? getApiErrorMessage(apiError, "Unable to save the stage.")
    : null;

  const [name, setName] = useState(stage?.name ?? "");
  const [description, setDescription] = useState(stage?.description ?? "");
  const [weight, setWeight] = useState(
    stage ? basisPointsToPercentInput(stage.weightBps) : "",
  );
  // A lifecycle contract's weights are fixed once it is active (D-4).
  const weightLocked = stage !== null && !project.permissions.canChangePlan;
  const [start, setStart] = useState(stage?.plannedStartDate ?? "");
  const [end, setEnd] = useState(stage?.plannedEndDate ?? "");
  const [overrideReason, setOverrideReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // An edited stage's milestones, to say which would fall outside new dates.
  const milestones = useGetMilestonesQuery(
    {
      companyId,
      contractId,
      contractStageId: stage?.id,
      page: 1,
      limit: 100,
    },
    { skip: !stage },
  );
  const datesChanged =
    !!stage &&
    (start !== stage.plannedStartDate || end !== stage.plannedEndDate);
  const outside =
    datesChanged && start && end && start <= end
      ? milestonesOutsideDates(milestones.currentData?.data ?? [], start, end)
      : [];
  const needsOverride =
    outside.length > 0 || (datesChanged && asksForDateOverride(apiMessage));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    const weightBps = parsePercentToBasisPoints(weight);
    if (!name.trim()) next.name = "Enter the stage's name.";
    if (weightBps === null) {
      next.weight = "Enter a share between 0 and 100, with up to two decimals.";
    }
    if (!start) next.start = "Choose the planned start.";
    if (!end) next.end = "Choose the planned end.";
    if (start && end && end < start) {
      next.end = "The planned end can't be before the planned start.";
    }
    if (needsOverride && !overrideReason.trim()) {
      next.override =
        "Explain why the stage's milestones may fall outside these dates.";
    }
    setErrors(next);
    if (Object.keys(next).length || weightBps === null) return;

    const plan = {
      name: name.trim(),
      description: description.trim() || null,
      weightBps,
      plannedStartDate: start,
      plannedEndDate: end,
    };
    let result;
    if (stage) {
      // Only what changed, so an unchanged field is never re-validated.
      const body: UpdateContractStageRequest = {};
      if (plan.name !== stage.name) body.name = plan.name;
      if (plan.description !== stage.description) {
        body.description = plan.description;
      }
      if (plan.weightBps !== stage.weightBps) body.weightBps = plan.weightBps;
      if (start !== stage.plannedStartDate) body.plannedStartDate = start;
      if (end !== stage.plannedEndDate) body.plannedEndDate = end;
      if (needsOverride) body.dateOverrideReason = overrideReason.trim();
      if (!Object.keys(body).length) {
        onDone();
        return;
      }
      result = await updateStage({
        companyId,
        contractId,
        stageId: stage.id,
        body,
      });
    } else {
      result = await createStage({ companyId, contractId, body: plan });
    }
    if (!("error" in result)) {
      notifySuccess(stage ? "Stage updated" : "Stage added", plan.name);
      onDone();
    }
  }

  const id = stage ? `stage-${stage.id}` : "stage-new";
  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex min-h-full flex-col"
      aria-label={stage ? `Edit stage ${stage.name}` : "Add a stage"}
    >
      <SheetHeader className="border-b">
        <SheetTitle>{stage ? `Edit ${stage.name}` : "Add a stage"}</SheetTitle>
        <SheetDescription>
          {stage
            ? "Changes are recorded in the contract's activity."
            : "A stage is a phase of the contract. Its milestones are planned within its dates."}
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-6 p-4">
        <RequiredFieldsNote />
        <FormSection legend="Stage">
          <FormGrid columns={1}>
            <FormField
              id={`${id}-name`}
              label="Name"
              required
              error={errors.name}
            >
              {(control) => (
                <Input
                  {...control}
                  value={name}
                  maxLength={255}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </FormField>
            <FormField id={`${id}-description`} label="Description" optional>
              {(control) => (
                <Textarea
                  {...control}
                  value={description}
                  maxLength={5000}
                  rows={3}
                  onChange={(event) => setDescription(event.target.value)}
                />
              )}
            </FormField>
            <FormField
              id={`${id}-weight`}
              label="Share of the contract (%)"
              required
              error={errors.weight}
              description={
                weightLocked
                  ? "Fixed once the contract is active. Mark a stage as not applying instead."
                  : "All the contract's stages together can add up to 100% at most."
              }
            >
              {(control) => (
                <Input
                  {...control}
                  value={weight}
                  inputMode="decimal"
                  readOnly={weightLocked}
                  aria-readonly={weightLocked || undefined}
                  onChange={(event) => setWeight(event.target.value)}
                />
              )}
            </FormField>
          </FormGrid>
        </FormSection>
        <FormSection
          legend="Planned dates"
          description="Each milestone's planned start and due date must fall within these dates."
        >
          <FormGrid columns={2}>
            <FormField
              id={`${id}-start`}
              label="Planned start"
              required
              error={errors.start}
            >
              {(control) => (
                <Input
                  {...control}
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              )}
            </FormField>
            <FormField
              id={`${id}-end`}
              label="Planned end"
              required
              error={errors.end}
            >
              {(control) => (
                <Input
                  {...control}
                  type="date"
                  value={end}
                  min={start || undefined}
                  onChange={(event) => setEnd(event.target.value)}
                />
              )}
            </FormField>
          </FormGrid>
          {needsOverride ? (
            <div className="space-y-3 rounded-xl border bg-warning-soft p-4 text-warning-soft-foreground">
              {outside.length ? (
                <div className="space-y-1 text-sm">
                  <p className="font-medium">
                    {outside.length === 1
                      ? "1 milestone would fall outside these dates:"
                      : `${outside.length} milestones would fall outside these dates:`}
                  </p>
                  <ul className="list-disc ps-5 text-muted-foreground">
                    {outside.map((milestone) => (
                      <li key={milestone.id}>
                        {milestone.title} (
                        {milestone.plannedStartDate
                          ? `${formatCalendarDate(milestone.plannedStartDate)} – `
                          : "due "}
                        {formatCalendarDate(milestone.dueDate)})
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground">
                    Their dates are not changed. Give a reason to plan the stage
                    this way anyway; it is recorded in the activity.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Some of this stage&apos;s milestones would fall outside these
                  dates. Give a reason to plan it this way anyway.
                </p>
              )}
              <FormField
                id={`${id}-override`}
                label="Date override reason"
                required
                error={errors.override}
              >
                {(control) => (
                  <Textarea
                    {...control}
                    value={overrideReason}
                    maxLength={2000}
                    rows={2}
                    onChange={(event) => setOverrideReason(event.target.value)}
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
          {saving ? "Saving…" : stage ? "Save stage" : "Add stage"}
        </Button>
      </SheetFooter>
    </form>
  );
}

/**
 * Starting, holding, resuming or completing a stage, confirmed first. Holding
 * and resuming need a reason; starting and completing record an actual date,
 * today in the contract's time zone unless one is given.
 */
function StageTransitionDialog({
  project,
  stage,
  transition,
  onClose,
}: {
  project: ProjectContext;
  stage: ContractStage;
  transition: StageTransition;
  onClose: () => void;
}) {
  const meta = STAGE_TRANSITIONS[transition];
  const [transitionStage, state] = useTransitionContractStageMutation();
  const [reason, setReason] = useState("");
  const [day, setDay] = useState("");
  const [missingReason, setMissingReason] = useState(false);

  async function confirm() {
    if (meta.needsReason && !reason.trim()) {
      setMissingReason(true);
      return;
    }
    const result = await transitionStage({
      companyId: project.companyId,
      contractId: project.contractId,
      stageId: stage.id,
      body: {
        status: meta.to,
        reason: reason.trim() || null,
        ...(meta.recordsDate && day ? { effectiveDate: day } : {}),
      },
    });
    if (!("error" in result)) {
      notifySuccess(meta.done, stage.name);
      onClose();
    }
  }

  const id = `stage-${stage.id}-${transition}`;
  return (
    <ConfirmDialog
      open
      title={`${meta.label}: ${stage.name}?`}
      description={
        transition === "complete"
          ? "A stage completes once all its milestones are approved. It can't be planned or reopened afterwards."
          : transition === "hold"
            ? "While the stage is on hold, its milestones can't be started or submitted."
            : transition === "resume"
              ? "The stage returns to in progress, and its milestones can be worked on again."
              : "The stage moves to in progress and records its actual start."
      }
      confirmLabel={meta.label}
      pendingLabel="Saving…"
      isPending={state.isLoading}
      error={
        state.error
          ? getApiErrorMessage(state.error, "The stage couldn't be changed.")
          : null
      }
      onConfirm={() => void confirm()}
      onCancel={onClose}
    >
      <div className="space-y-4">
        {meta.recordsDate ? (
          <FormField
            id={`${id}-day`}
            label={transition === "start" ? "Actual start" : "Actual end"}
            optional
            description={`Leave empty for today in the contract's time zone (${project.contract.timezone}).`}
          >
            {(control) => (
              <Input
                {...control}
                type="date"
                value={day}
                onChange={(event) => setDay(event.target.value)}
              />
            )}
          </FormField>
        ) : null}
        <FormField
          id={`${id}-reason`}
          label="Reason"
          required={meta.needsReason}
          optional={!meta.needsReason}
          error={missingReason ? "Give a reason." : undefined}
        >
          {(control) => (
            <Textarea
              {...control}
              value={reason}
              maxLength={2000}
              rows={3}
              onChange={(event) => {
                setReason(event.target.value);
                setMissingReason(false);
              }}
            />
          )}
        </FormField>
      </div>
    </ConfirmDialog>
  );
}

/**
 * Marks a planned stage as not applying to the contract (a reason is
 * required), or reinstates it. The API refuses a stage with milestones.
 */
function StageApplicabilityDialog({
  project,
  stage,
  onClose,
}: {
  project: ProjectContext;
  stage: ContractStage;
  onClose: () => void;
}) {
  const excluding = stage.isApplicable !== false;
  const [setApplicability, state] = useSetContractStageApplicabilityMutation();
  const [reason, setReason] = useState("");
  const [missingReason, setMissingReason] = useState(false);

  async function confirm() {
    if (excluding && !reason.trim()) {
      setMissingReason(true);
      return;
    }
    const result = await setApplicability({
      companyId: project.companyId,
      contractId: project.contractId,
      stageId: stage.id,
      body: { isApplicable: !excluding, reason: reason.trim() || null },
    });
    if (!("error" in result)) {
      notifySuccess(
        excluding ? "Stage marked as not applying" : "Stage reinstated",
        stage.name,
      );
      onClose();
    }
  }

  const label = excluding ? "Mark as not applying" : "Reinstate stage";
  return (
    <ConfirmDialog
      open
      title={`${label}: ${stage.name}?`}
      description={
        excluding
          ? "The stage stays on record but counts for nothing in progress, and takes no milestones until it is reinstated."
          : "The stage counts towards progress again and can be planned."
      }
      confirmLabel={label}
      pendingLabel="Saving…"
      isPending={state.isLoading}
      error={
        state.error
          ? getApiErrorMessage(state.error, "The stage couldn't be changed.")
          : null
      }
      onConfirm={() => void confirm()}
      onCancel={onClose}
    >
      <FormField
        id={`stage-${stage.id}-applicability-reason`}
        label="Reason"
        required={excluding}
        optional={!excluding}
        error={
          missingReason
            ? "Say why the stage doesn't apply to this contract."
            : undefined
        }
      >
        {(control) => (
          <Textarea
            {...control}
            value={reason}
            maxLength={2000}
            rows={3}
            onChange={(event) => {
              setReason(event.target.value);
              setMissingReason(false);
            }}
          />
        )}
      </FormField>
    </ConfirmDialog>
  );
}
