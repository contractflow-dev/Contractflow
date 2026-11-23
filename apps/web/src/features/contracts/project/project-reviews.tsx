"use client";

import Link from "next/link";
import type { Milestone } from "@contractflow/contracts-schema";
import { Badge } from "@workspace/ui/components/badge";
import {
  DataTable,
  DataTableEmpty,
  type DataTableColumn,
} from "@/components/data-table/data-table";
import { ListCard } from "@/components/data-table/list-card";
import { useKeepPageInRange, usePagination } from "@/hooks/use-pagination";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  formatBasisPoints,
  formatCalendarDate,
  formatDateTime,
} from "@/lib/format";
import {
  useGetMilestoneSubmissionsQuery,
  useGetMilestonesQuery,
} from "@/services/deliveryApi";
import { milestoneHref, useStageNames } from "./project-milestones";
import { SUBMISSION_TYPE_LABEL } from "./project-rules";
import {
  OverdueBadge,
  ProjectStatusNotice,
  type ProjectContext,
} from "./project-ui";

/**
 * Milestones waiting for the Client Project Manager's decision, soonest due
 * first (the API's order). Each row says what kind of submission it is, how
 * much evidence it has and how many decisions came before.
 */
export function ProjectReviews({ project }: { project: ProjectContext }) {
  const { companyId, contractId, permissions } = project;
  const timeZone = useUserTimeZone();
  const pagination = usePagination(10);
  const { name: stageName } = useStageNames(project);
  const queue = useGetMilestonesQuery({
    companyId,
    contractId,
    pendingReview: true,
    page: pagination.page,
    limit: pagination.limit,
  });
  useKeepPageInRange(queue.currentData?.meta, pagination.setPage);

  const columns: ReadonlyArray<DataTableColumn<Milestone>> = [
    {
      id: "milestone",
      header: "Milestone",
      wrap: true,
      className: "min-w-52",
      cell: (milestone) => (
        <>
          <Link
            href={milestoneHref(contractId, milestone.id)}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {milestone.title}
          </Link>
          <span className="block text-xs text-muted-foreground">
            {stageName(milestone.contractStageId) ?? "Stage"}
          </span>
        </>
      ),
    },
    {
      id: "submitted",
      header: "Submitted",
      cell: (milestone) => formatDateTime(milestone.submittedAt, { timeZone }),
    },
    {
      id: "due",
      header: "Due",
      cell: (milestone) => (
        <span className="flex flex-wrap items-center gap-1.5">
          {formatCalendarDate(milestone.revisedDueDate ?? milestone.dueDate)}
          {milestone.isOverdue ? <OverdueBadge /> : null}
        </span>
      ),
    },
    {
      id: "progress",
      header: "Approved so far",
      numeric: true,
      hideBelow: "md",
      cell: (milestone) => formatBasisPoints(milestone.approvedBps),
    },
    {
      id: "submission",
      header: "Submission",
      wrap: true,
      hideBelow: "md",
      cell: (milestone) => (
        <SubmissionSummary project={project} milestone={milestone} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <ProjectStatusNotice notice={permissions.statusNotice} />
      <ListCard
        title="Awaiting your review"
        description="Submissions from the contractor waiting for a decision, soonest due first. Open one to review its evidence and decide."
      >
        <DataTable
          label="Milestones awaiting review"
          columns={columns}
          rows={queue.currentData?.data ?? []}
          getRowKey={(milestone) => milestone.id}
          isLoading={queue.isLoading}
          loadingLabel="Loading the review queue…"
          error={
            queue.error
              ? getApiErrorMessage(
                  queue.error,
                  "Unable to load the review queue.",
                )
              : null
          }
          onRetry={() => void queue.refetch()}
          empty={
            <DataTableEmpty
              title="Nothing is waiting for review"
              description="When the contractor submits a milestone, it appears here."
            />
          }
          pagination={
            queue.currentData
              ? {
                  meta: queue.currentData.meta,
                  itemLabel: "milestones",
                  isFetching: queue.isFetching,
                  onPageChange: pagination.setPage,
                  onPageSizeChange: pagination.setLimit,
                }
              : undefined
          }
        />
      </ListCard>
    </div>
  );
}

/** The latest submission's kind and evidence, and the decisions before it. */
function SubmissionSummary({
  project,
  milestone,
}: {
  project: ProjectContext;
  milestone: Milestone;
}) {
  const history = useGetMilestoneSubmissionsQuery({
    companyId: project.companyId,
    contractId: project.contractId,
    milestoneId: milestone.id,
  });
  const submissions = history.currentData;
  if (!submissions) {
    return (
      <span className="text-muted-foreground">
        {history.error ? "Not available" : "…"}
      </span>
    );
  }
  const latest = submissions.at(-1);
  const earlier = submissions.filter(({ decision }) => decision).length;
  if (!latest) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs">
      <Badge variant="outline" className="font-normal">
        {SUBMISSION_TYPE_LABEL[latest.submissionType]}
      </Badge>
      <span>
        {latest.evidence.length} evidence file
        {latest.evidence.length === 1 ? "" : "s"}
      </span>
      {earlier ? (
        <span className="text-muted-foreground">
          · {earlier} earlier decision{earlier === 1 ? "" : "s"}
        </span>
      ) : null}
    </span>
  );
}
