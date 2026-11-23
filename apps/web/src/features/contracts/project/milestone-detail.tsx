"use client";

import Link from "next/link";
import { useState } from "react";
import { RiArrowLeftLine, RiLockLine } from "@remixicon/react";
import {
  EMilestoneOutstandingItemStatus,
  EMilestoneStatus,
} from "@contractflow/contracts-schema";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { DataTableError } from "@/components/data-table/data-table";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import {
  formatBasisPoints,
  formatCalendarDate,
  formatMoneyMinor,
  formatNumber,
} from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import {
  useGetContractStageQuery,
  useGetMilestoneOutstandingItemsQuery,
  useGetMilestoneQuery,
  useGetMilestoneSubmissionsQuery,
  useStartMilestoneMutation,
} from "@/services/deliveryApi";
import { contractWorkspaceHref } from "../contract-workspaces";
import { MilestoneDecisionForm } from "./milestone-decision-form";
import { MilestoneSheet } from "./milestone-form";
import { SubmissionHistory, WorkBreakdown } from "./milestone-history";
import { MilestoneSubmissionForm } from "./milestone-submission-form";
import {
  isMilestoneLocked,
  isScopeFrozen,
  isSubmittable,
  stageBlocksWork,
} from "./project-rules";
import {
  BpsMeter,
  Detail,
  FormSheet,
  MilestoneStatus,
  ProjectStatusNotice,
  Prose,
  type ProjectContext,
} from "./project-ui";

type Panel = "edit" | "submit" | "decide" | null;

/**
 * One milestone: its plan, progress, approved and outstanding work, and
 * its full submission and decision history. Actions appear only for the
 * role and contract status the API allows them for, and the API decides.
 */
export function MilestoneDetail({
  project,
  milestoneId,
}: {
  project: ProjectContext;
  milestoneId: string;
}) {
  const { companyId, contractId, contract, permissions } = project;
  const scope = { companyId, contractId, milestoneId };
  const milestone = useGetMilestoneQuery(scope);
  const submissions = useGetMilestoneSubmissionsQuery(scope);
  const items = useGetMilestoneOutstandingItemsQuery(scope);
  const data = milestone.currentData;
  const stage = useGetContractStageQuery(
    { companyId, contractId, stageId: data?.contractStageId ?? "" },
    { skip: !data },
  );
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [start, startState] = useStartMilestoneMutation();
  const back = contractWorkspaceHref(contractId, "project", "milestones");

  if (milestone.isLoading) {
    return (
      <div role="status" aria-label="Loading milestone" className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (milestone.error || !data) {
    const missing = getApiErrorStatus(milestone.error) === 404;
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>
              {missing
                ? "Milestone was not found"
                : "The milestone could not be loaded"}
            </h2>
          </CardTitle>
          <CardDescription>
            {missing
              ? "It may belong to another contract, or it no longer exists."
              : getApiErrorMessage(milestone.error, "Try again in a moment.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link
            href={back}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Back to milestones
          </Link>
          {missing ? null : (
            <Button
              type="button"
              variant="outline"
              onClick={() => void milestone.refetch()}
            >
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const history = submissions.currentData ?? [];
  const outstanding = items.currentData ?? [];
  const openItems = outstanding.filter(
    (item) => item.status === EMilestoneOutstandingItemStatus.OUTSTANDING,
  );
  const latest = history.at(-1) ?? null;
  const blocked = stageBlocksWork(stage.currentData);
  const awaiting =
    data.status === EMilestoneStatus.PENDING_APPROVAL &&
    latest !== null &&
    latest.decision === null;
  const latestDecision = [...history]
    .reverse()
    .find(({ decision }) => decision)?.decision;

  const canEdit = permissions.canPlan && !isMilestoneLocked(data);
  const canStart =
    permissions.canSubmit &&
    data.status === EMilestoneStatus.PLANNED &&
    !blocked;
  const canSubmit =
    permissions.canSubmit &&
    isSubmittable(data.status) &&
    !blocked &&
    !items.isLoading &&
    !items.error;
  const canDecide =
    permissions.canOperateAsPlanner && awaiting && !items.isLoading;
  const resubmitting =
    data.status === EMilestoneStatus.REJECTED ||
    data.status === EMilestoneStatus.PARTIALLY_APPROVED;

  async function confirmStart() {
    const result = await start(scope);
    if (!("error" in result)) {
      notifySuccess("Work started", data!.title);
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={back}
        className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
      >
        <RiArrowLeftLine aria-hidden="true" className="size-4" />
        All milestones
      </Link>
      <ProjectStatusNotice notice={permissions.statusNotice} />

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm text-muted-foreground">
                {stage.currentData
                  ? `Stage ${stage.currentData.sequence}: ${stage.currentData.name}`
                  : "Milestone"}
              </p>
              <CardTitle>
                <h2 className="type-section-title break-words">{data.title}</h2>
              </CardTitle>
              <MilestoneStatus milestone={data} />
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPanel("edit")}
                >
                  {isScopeFrozen(data) ? "Change dates" : "Edit milestone"}
                </Button>
              ) : null}
              {canStart ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStarting(true)}
                >
                  Start work
                </Button>
              ) : null}
              {canSubmit ? (
                <Button type="button" onClick={() => setPanel("submit")}>
                  {openItems.length
                    ? "Submit outstanding work"
                    : resubmitting
                      ? "Resubmit"
                      : "Submit for review"}
                </Button>
              ) : null}
              {canDecide ? (
                <Button type="button" onClick={() => setPanel("decide")}>
                  Review submission
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {blocked && (permissions.isSubmitter || permissions.isPlanner) ? (
            <Alert>
              <AlertDescription>{blocked}</AlertDescription>
            </Alert>
          ) : null}
          {data.status === EMilestoneStatus.REJECTED && data.rejectionReason ? (
            <Alert variant="destructive">
              <AlertTitle>The latest submission was rejected</AlertTitle>
              <AlertDescription className="whitespace-pre-line">
                {data.rejectionReason}
              </AlertDescription>
            </Alert>
          ) : null}
          {data.status === EMilestoneStatus.PARTIALLY_APPROVED ? (
            <Alert>
              <AlertTitle>Partly approved: outstanding work remains</AlertTitle>
              <AlertDescription>
                {formatBasisPoints(data.approvedBps)} is accepted and stays
                accepted.{" "}
                {latestDecision?.reason
                  ? `Reason: ${latestDecision.reason} `
                  : ""}
                The next submission covers only the {openItems.length}{" "}
                outstanding item{openItems.length === 1 ? "" : "s"}.
              </AlertDescription>
            </Alert>
          ) : null}
          {awaiting && permissions.isSubmitter ? (
            <Alert>
              <AlertDescription>
                Submission {latest?.sequence} is waiting for the Client Project
                Manager&apos;s decision.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <BpsMeter
                value={data.approvedBps}
                label="Approved by the client"
              />
              <BpsMeter
                value={data.progressBps}
                label="Reported by the contractor"
              />
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail label="Planned start">
                {formatCalendarDate(data.plannedStartDate)}
              </Detail>
              <Detail label="Due">
                {formatCalendarDate(data.revisedDueDate ?? data.dueDate)}
                {data.revisedDueDate ? (
                  <span className="block text-xs text-muted-foreground">
                    Originally {formatCalendarDate(data.dueDate)}
                  </span>
                ) : null}
              </Detail>
              <Detail label="Actual start">
                {formatCalendarDate(data.actualStartDate)}
              </Detail>
              <Detail label="Completed">
                {formatCalendarDate(data.completedDate)}
              </Detail>
            </dl>
          </div>
          <p className="text-xs text-muted-foreground">
            Dates and overdue follow the contract&apos;s time zone (
            {contract.timezone}).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Scope</h2>
          </CardTitle>
          {isScopeFrozen(data) ? (
            <CardDescription className="flex items-center gap-1.5">
              <RiLockLine aria-hidden="true" className="size-4" />
              Fixed since the first submission. Only the dates can change.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Description" className="sm:col-span-2">
              <Prose text={data.description} />
            </Detail>
            <Detail label="Acceptance criteria">
              <Prose text={data.acceptanceCriteria} />
            </Detail>
            <Detail label="Deliverables">
              <Prose text={data.deliverables} />
            </Detail>
            <Detail label="Share of the stage">
              {formatBasisPoints(data.weightBps)}
            </Detail>
            <Detail label="Target">
              {data.targetQuantity !== null
                ? `${formatNumber(data.approvedQuantity ?? 0)} of ${formatNumber(data.targetQuantity)} ${data.quantityUnit ?? ""} accepted`
                : "No measurable target"}
            </Detail>
            <Detail label="Payment milestone">
              {data.isPaymentMilestone
                ? `Yes, ${formatMoneyMinor(data.amountMinor, data.currencyCode)}. Approval doesn't invoice it.`
                : "No"}
            </Detail>
          </dl>
        </CardContent>
      </Card>

      {history.some(({ decision }) => decision) || outstanding.length ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Approved and outstanding work</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WorkBreakdown submissions={history} items={outstanding} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Submissions and decisions</h2>
          </CardTitle>
          <CardDescription>
            Every submission and decision, oldest first. They are never changed
            once recorded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submissions.isLoading || items.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : submissions.error || items.error ? (
            <DataTableError
              message={getApiErrorMessage(
                submissions.error ?? items.error,
                "Unable to load the milestone's history.",
              )}
              onRetry={() => {
                void submissions.refetch();
                void items.refetch();
              }}
            />
          ) : (
            <SubmissionHistory
              project={project}
              submissions={history}
              items={outstanding}
            />
          )}
        </CardContent>
      </Card>

      <MilestoneSheet
        project={project}
        open={panel === "edit"}
        stage={null}
        milestone={data}
        onClose={() => setPanel(null)}
      />
      <FormSheet
        open={panel === "submit"}
        busy={busy}
        onClose={() => setPanel(null)}
      >
        <MilestoneSubmissionForm
          project={project}
          milestone={data}
          openItems={openItems}
          onBusyChange={setBusy}
          onDone={() => setPanel(null)}
        />
      </FormSheet>
      <FormSheet
        open={panel === "decide"}
        busy={busy}
        onClose={() => setPanel(null)}
      >
        {latest ? (
          <MilestoneDecisionForm
            project={project}
            milestone={data}
            submission={latest}
            openItems={openItems}
            onBusyChange={setBusy}
            onDone={() => setPanel(null)}
          />
        ) : null}
      </FormSheet>
      <ConfirmDialog
        open={starting}
        title={`Start work on ${data.title}?`}
        description={`The milestone moves to in progress, with today in the contract's time zone (${contract.timezone}) as its actual start.`}
        confirmLabel="Start work"
        pendingLabel="Starting…"
        isPending={startState.isLoading}
        error={
          startState.error
            ? getApiErrorMessage(startState.error, "Work couldn't be started.")
            : null
        }
        onConfirm={() => void confirmStart()}
        onCancel={() => setStarting(false)}
      />
    </div>
  );
}
