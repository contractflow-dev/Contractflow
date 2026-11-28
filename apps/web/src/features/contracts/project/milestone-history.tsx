"use client";

import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiDownloadLine,
  RiFileTextLine,
  RiIndeterminateCircleLine,
  RiSendPlaneLine,
} from "@remixicon/react";
import {
  EMilestoneDecisionType,
  EMilestoneOutstandingItemStatus,
  type MilestoneDecision,
  type MilestoneEvidence,
  type MilestoneOutstandingItem,
  type MilestoneSubmission,
} from "@contractflow/contracts-schema";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { StatusBadge } from "@/components/status-badge/status-badge";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { formatBasisPoints, formatDateTime, formatNumber } from "@/lib/format";
import { notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useCreateDocumentDownloadUrlMutation } from "@/services/documentsApi";
import {
  DECISION_LABEL,
  SUBMISSION_TYPE_LABEL,
  actorLabel,
  projectRoleNames,
} from "./project-rules";
import type { ProjectContext } from "./project-ui";

const DECISION_ICON = {
  [EMilestoneDecisionType.APPROVED]: RiCheckboxCircleLine,
  [EMilestoneDecisionType.PARTIALLY_APPROVED]: RiIndeterminateCircleLine,
  [EMilestoneDecisionType.REJECTED]: RiCloseCircleLine,
};

/** Downloads the exact file version kept with a submission. */
export function useEvidenceDownload(project: ProjectContext) {
  const [createUrl, state] = useCreateDocumentDownloadUrlMutation();
  return {
    isLoading: state.isLoading,
    async start(evidence: MilestoneEvidence) {
      try {
        const { url } = await createUrl({
          companyId: project.companyId,
          contractId: project.contractId,
          documentId: evidence.documentId,
          versionId: evidence.documentVersionId,
        }).unwrap();
        // Signed as an attachment, so the page stays put; never stored.
        window.location.assign(url);
      } catch (error) {
        notifyError(
          error,
          "The file couldn't be downloaded.",
          "Download failed",
        );
      }
    },
  };
}

export function EvidenceList({
  project,
  evidence,
}: {
  project: ProjectContext;
  evidence: readonly MilestoneEvidence[];
}) {
  const download = useEvidenceDownload(project);
  if (!evidence.length) {
    return <p className="text-sm text-muted-foreground">No evidence files.</p>;
  }
  return (
    <ul className="divide-y rounded-xl border">
      {evidence.map((file) => (
        <li
          key={file.id}
          className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
        >
          <span className="flex min-w-0 items-start gap-2">
            <RiFileTextLine
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium break-words">
                {file.title}
              </span>
              <span className="block text-xs break-words text-muted-foreground">
                {file.fileName} · version {file.versionNumber}
                {file.caption ? ` · ${file.caption}` : ""}
              </span>
            </span>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={download.isLoading}
            aria-label={`Download ${file.title}, version ${file.versionNumber}`}
            onClick={() => void download.start(file)}
          >
            <RiDownloadLine aria-hidden="true" data-icon="inline-start" />
            Download
          </Button>
        </li>
      ))}
    </ul>
  );
}

/**
 * What has been accepted and what is still outstanding: each decision's
 * approved work, and every outstanding item with where it stands. Accepted
 * work stays recorded; resubmissions address only what is outstanding.
 */
export function WorkBreakdown({
  submissions,
  items,
}: {
  submissions: readonly MilestoneSubmission[];
  items: readonly MilestoneOutstandingItem[];
}) {
  const accepted = submissions.flatMap(({ sequence, decision }) =>
    decision &&
    decision.decision !== EMilestoneDecisionType.REJECTED &&
    (decision.approvedWork || decision.approvedBps > 0)
      ? [{ sequence, decision }]
      : [],
  );
  const open = items.filter(
    (item) => item.status === EMilestoneOutstandingItemStatus.OUTSTANDING,
  );
  const done = items.filter(
    (item) => item.status === EMilestoneOutstandingItemStatus.ACCEPTED,
  );
  if (!accepted.length && !items.length) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="approved-work-heading" className="space-y-2">
        <h3 id="approved-work-heading" className="type-subsection-title">
          Approved work
        </h3>
        {accepted.length ? (
          <ul className="space-y-2">
            {accepted.map(({ sequence, decision }) => (
              <li
                key={decision.id}
                className="rounded-xl border bg-success-soft p-3 text-sm text-success-soft-foreground"
              >
                <p className="font-medium">
                  {formatBasisPoints(decision.approvedBps)} accepted from
                  submission {sequence}
                  {decision.approvedQuantity != null
                    ? ` (${formatNumber(decision.approvedQuantity)})`
                    : ""}
                </p>
                {decision.approvedWork ? (
                  <p className="whitespace-pre-line">{decision.approvedWork}</p>
                ) : null}
              </li>
            ))}
            {done.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border bg-success-soft p-3 text-sm text-success-soft-foreground"
              >
                <p className="font-medium">Outstanding item accepted</p>
                <p className="whitespace-pre-line">
                  {item.description}
                  {item.quantity != null
                    ? ` (${formatNumber(item.quantity)})`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing accepted yet.</p>
        )}
      </section>
      <section aria-labelledby="outstanding-work-heading" className="space-y-2">
        <h3 id="outstanding-work-heading" className="type-subsection-title">
          Outstanding work
        </h3>
        {open.length ? (
          <ul className="space-y-2">
            {open.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-xl border bg-warning-soft p-3 text-sm text-warning-soft-foreground"
              >
                <span className="whitespace-pre-line">
                  {item.description}
                  {item.quantity != null
                    ? ` (${formatNumber(item.quantity)})`
                    : ""}
                </span>
                <StatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing is outstanding.
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * Every submission, oldest first, each with its evidence and the decision on
 * it, as the API records them; nothing here is edited or merged.
 */
export function SubmissionHistory({
  project,
  submissions,
  items,
}: {
  project: ProjectContext;
  submissions: readonly MilestoneSubmission[];
  items: readonly MilestoneOutstandingItem[];
}) {
  const timeZone = useUserTimeZone();
  const itemText = (id: string) =>
    items.find((item) => item.id === id)?.description ?? "An outstanding item";
  const answered = (decisionId: string | null) =>
    submissions.find(({ decision }) => decision?.id === decisionId);

  if (!submissions.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing has been submitted yet.
      </p>
    );
  }
  return (
    <ol aria-label="Submission history" className="space-y-4">
      {submissions.map((submission) => {
        const previous = answered(submission.previousDecisionId);
        return (
          <li
            key={submission.id}
            id={`submission-${submission.id}`}
            className="space-y-3 rounded-xl border p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <RiSendPlaneLine
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                <h3 className="font-medium">
                  Submission {submission.sequence}
                </h3>
                <Badge variant="outline" className="font-normal">
                  {SUBMISSION_TYPE_LABEL[submission.submissionType]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {actorLabel(
                  submission.submittedById,
                  project.viewerMembershipId,
                  projectRoleNames(project.contract).lead,
                )}{" "}
                ·{" "}
                <time dateTime={submission.submittedAt}>
                  {formatDateTime(submission.submittedAt, { timeZone })}
                </time>
              </p>
            </div>
            {previous?.decision ? (
              <p className="text-xs text-muted-foreground">
                Answers the{" "}
                {DECISION_LABEL[previous.decision.decision].toLowerCase()}{" "}
                decision on submission {previous.sequence}.
              </p>
            ) : null}
            <p className="text-sm whitespace-pre-line">{submission.notes}</p>
            {submission.reportedProgressBps != null ? (
              <p className="text-xs text-muted-foreground">
                Reported completion:{" "}
                {formatBasisPoints(submission.reportedProgressBps)}
              </p>
            ) : null}
            {submission.addressedItemIds.length ? (
              <div className="space-y-1">
                <p className="text-xs font-medium">Outstanding items covered</p>
                <ul className="list-disc ps-5 text-sm text-muted-foreground">
                  {submission.addressedItemIds.map((id) => (
                    <li key={id}>{itemText(id)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="space-y-1">
              <p className="text-xs font-medium">
                Evidence ({submission.evidence.length})
              </p>
              <EvidenceList project={project} evidence={submission.evidence} />
            </div>
            {submission.decision ? (
              <DecisionRecord
                decision={submission.decision}
                project={project}
                itemText={itemText}
                timeZone={timeZone}
              />
            ) : (
              <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                Waiting for the {projectRoleNames(project.contract).planner}
                &apos;s decision.
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function DecisionRecord({
  decision,
  project,
  itemText,
  timeZone,
}: {
  decision: MilestoneDecision;
  project: ProjectContext;
  itemText: (id: string) => string;
  timeZone: string | undefined;
}) {
  const Icon = DECISION_ICON[decision.decision];
  const tone =
    decision.decision === EMilestoneDecisionType.APPROVED
      ? "bg-success-soft text-success-soft-foreground"
      : decision.decision === EMilestoneDecisionType.REJECTED
        ? "bg-destructive/10"
        : "bg-info-soft text-info-soft-foreground";
  return (
    <div
      className={cn("space-y-2 rounded-xl border p-3 text-sm", tone)}
      aria-label={`Decision: ${DECISION_LABEL[decision.decision]}`}
      role="group"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium">
          <Icon aria-hidden="true" className="size-4" />
          {DECISION_LABEL[decision.decision]}
        </p>
        <p className="text-xs opacity-80">
          {actorLabel(
            decision.decidedById,
            project.viewerMembershipId,
            projectRoleNames(project.contract).planner,
          )}{" "}
          ·{" "}
          <time dateTime={decision.decidedAt}>
            {formatDateTime(decision.decidedAt, { timeZone })}
          </time>
        </p>
      </div>
      {decision.reason ? (
        <p className="whitespace-pre-line">
          <span className="font-medium">Reason: </span>
          {decision.reason}
        </p>
      ) : null}
      {decision.decision !== EMilestoneDecisionType.REJECTED ? (
        <p>
          This decision accepted {formatBasisPoints(decision.approvedBps)}; the
          milestone is {formatBasisPoints(decision.cumulativeApprovedBps)}{" "}
          approved.
        </p>
      ) : null}
      {decision.approvedWork ? (
        <p className="whitespace-pre-line">
          <span className="font-medium">Approved work: </span>
          {decision.approvedWork}
        </p>
      ) : null}
      {decision.raisedItemIds.length ? (
        <div>
          <p className="font-medium">Outstanding work raised</p>
          <ul className="list-disc ps-5">
            {decision.raisedItemIds.map((id) => (
              <li key={id}>{itemText(id)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {decision.acceptedItemIds.length ? (
        <div>
          <p className="font-medium">Outstanding items accepted</p>
          <ul className="list-disc ps-5">
            {decision.acceptedItemIds.map((id) => (
              <li key={id}>{itemText(id)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
