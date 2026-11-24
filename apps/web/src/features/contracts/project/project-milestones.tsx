"use client";

import Link from "next/link";
import { useState } from "react";
import { RiAddLine } from "@remixicon/react";
import {
  EMilestoneStatus,
  type ContractStage,
  type ListMilestonesFilters,
  type Milestone,
} from "@contractflow/contracts-schema";
import { Button } from "@workspace/ui/components/button";
import {
  DataTable,
  DataTableEmpty,
  type DataTableColumn,
} from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DataTableFilters } from "@/components/data-table/data-table-filters";
import { ListCard } from "@/components/data-table/list-card";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useKeepPageInRange, usePagination } from "@/hooks/use-pagination";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  dayBoundsInTimeZone,
  formatBasisPoints,
  formatCalendarDate,
  formatDate,
  resolveTimeZone,
} from "@/lib/format";
import { getStatusPresentation } from "@/components/status-badge/status-badge";
import {
  useGetContractStagesQuery,
  useGetMilestonesQuery,
} from "@/services/deliveryApi";
import { contractWorkspaceHref } from "../contract-workspaces";
import { MilestoneSheet } from "./milestone-form";
import { MILESTONE_FILTER_STATUSES } from "./project-rules";
import {
  BpsMeter,
  DayRange,
  MilestoneStatus,
  ProjectStatusNotice,
  type ProjectContext,
} from "./project-ui";

type Quick = "all" | "pendingReview" | "overdue";

export interface MilestoneFilterValues {
  quick: Quick;
  stageId: string;
  status: EMilestoneStatus | "";
  submittedFromDay: string;
  submittedToDay: string;
}

export const NO_MILESTONE_FILTERS: MilestoneFilterValues = {
  quick: "all",
  stageId: "",
  status: "",
  submittedFromDay: "",
  submittedToDay: "",
};

/**
 * The API filters for the controls. Submission days are whole days in the
 * contract's time zone (UTC when the browser doesn't know it, as the API
 * falls back), sent as instants. A reversed range is reported, not sent.
 */
export function toMilestoneQueryFilters(
  values: MilestoneFilterValues,
  contractTimeZone: string | null | undefined,
): { filters: ListMilestonesFilters; rangeError: string | null } {
  const zone = resolveTimeZone(contractTimeZone) ?? "UTC";
  const from = values.submittedFromDay
    ? dayBoundsInTimeZone(values.submittedFromDay, zone)
    : null;
  const to = values.submittedToDay
    ? dayBoundsInTimeZone(values.submittedToDay, zone)
    : null;
  const rangeError =
    from && to && from.start > to.end
      ? "The submission range ends before it starts."
      : null;
  return {
    filters: {
      contractStageId: values.stageId || undefined,
      status: values.status || undefined,
      pendingReview: values.quick === "pendingReview" || undefined,
      overdue: values.quick === "overdue" || undefined,
      submittedFrom: rangeError ? undefined : from?.start,
      submittedTo: rangeError ? undefined : to?.end,
    },
    rangeError,
  };
}

export function milestoneHref(contractId: string, milestoneId: string) {
  return `${contractWorkspaceHref(contractId, "project", "milestones")}/${encodeURIComponent(milestoneId)}`;
}

/** Stage names by id, for the milestone rows. */
export function useStageNames(project: ProjectContext) {
  const stages = useGetContractStagesQuery({
    companyId: project.companyId,
    contractId: project.contractId,
    page: 1,
    limit: 100,
  });
  const list: ContractStage[] = stages.currentData?.data ?? [];
  return {
    stages: list,
    name: (id: string) => {
      const stage = list.find((candidate) => candidate.id === id);
      return stage ? `${stage.sequence}. ${stage.name}` : null;
    },
  };
}

/**
 * Every milestone of the contract, in due-date order (the API's), with the
 * filters the API applies: stage, status, waiting for review, overdue (in the
 * contract's time zone) and when work was submitted.
 */
export function ProjectMilestones({ project }: { project: ProjectContext }) {
  const { companyId, contractId, contract, permissions } = project;
  const timeZone = useUserTimeZone();
  const pagination = usePagination(20);
  const [values, setValues] = useState(NO_MILESTONE_FILTERS);
  const [adding, setAdding] = useState(false);
  const { stages, name: stageName } = useStageNames(project);

  // Days apply once they stop changing; clearing applies at once.
  const [debouncedFrom, debouncedTo] = useDebouncedValue(
    `${values.submittedFromDay}|${values.submittedToDay}`,
    400,
  ).split("|");
  const { filters } = toMilestoneQueryFilters(
    {
      ...values,
      submittedFromDay: values.submittedFromDay ? debouncedFrom : "",
      submittedToDay: values.submittedToDay ? debouncedTo : "",
    },
    contract.timezone,
  );
  const milestones = useGetMilestonesQuery({
    companyId,
    contractId,
    page: pagination.page,
    limit: pagination.limit,
    ...filters,
  });
  useKeepPageInRange(milestones.currentData?.meta, pagination.setPage);

  function update(next: Partial<MilestoneFilterValues>) {
    setValues((current) => ({ ...current, ...next }));
    pagination.resetPage();
  }

  const filtered =
    values.quick !== "all" ||
    Boolean(
      values.stageId ||
      values.status ||
      values.submittedFromDay ||
      values.submittedToDay,
    );

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
          {milestone.description ? (
            <span className="line-clamp-1 text-xs text-muted-foreground">
              {milestone.description}
            </span>
          ) : null}
        </>
      ),
    },
    {
      id: "status",
      header: "Status",
      wrap: true,
      cell: (milestone) => <MilestoneStatus milestone={milestone} />,
    },
    {
      id: "due",
      header: "Due",
      cell: (milestone) => (
        <span className="whitespace-nowrap">
          {formatCalendarDate(milestone.revisedDueDate ?? milestone.dueDate)}
          {milestone.revisedDueDate ? (
            <span className="block text-xs text-muted-foreground">
              Originally {formatCalendarDate(milestone.dueDate)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "planned",
      header: "Planned start",
      hideBelow: "lg",
      cell: (milestone) => formatCalendarDate(milestone.plannedStartDate),
    },
    {
      id: "actual",
      header: "Actual",
      hideBelow: "lg",
      cell: (milestone) => (
        <DayRange
          from={milestone.actualStartDate}
          to={milestone.completedDate}
        />
      ),
    },
    {
      id: "progress",
      header: "Approved",
      cell: (milestone) => (
        <div className="space-y-1">
          <BpsMeter value={milestone.approvedBps} label="Approved" hideLabel />
          {milestone.progressBps > 0 ? (
            <span className="block text-xs text-muted-foreground">
              Reported {formatBasisPoints(milestone.progressBps)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "submitted",
      header: "Last submitted",
      hideBelow: "md",
      cell: (milestone) =>
        milestone.submittedAt
          ? formatDate(milestone.submittedAt, { timeZone })
          : "Not yet",
    },
    {
      id: "weight",
      header: "Weight",
      numeric: true,
      hideBelow: "lg",
      cell: (milestone) => formatBasisPoints(milestone.weightBps),
    },
  ];

  return (
    <div className="space-y-4">
      <ProjectStatusNotice notice={permissions.statusNotice} />
      <ListCard
        title="Milestones"
        description="Every milestone of the contract, soonest due first. Overdue is judged in the contract's time zone."
        action={
          permissions.canPlan && stages.length ? (
            <Button type="button" onClick={() => setAdding(true)}>
              <RiAddLine aria-hidden="true" data-icon="inline-start" />
              Add milestone
            </Button>
          ) : null
        }
      >
        <DataTableToolbar>
          <DataTableFilters
            label="milestones"
            fields={[
              {
                kind: "select",
                id: "quick",
                group: "View",
                label: "Show",
                value: values.quick,
                resetValue: "all",
                options: [
                  { value: "all", label: "All" },
                  { value: "pendingReview", label: "Awaiting review" },
                  { value: "overdue", label: "Overdue" },
                ],
              },
              {
                kind: "select",
                id: "stage",
                group: "Milestone",
                label: "Stage",
                value: values.stageId,
                options: [
                  { value: "", label: "All stages" },
                  ...stages.map((stage) => ({
                    value: stage.id,
                    label: `${stage.sequence}. ${stage.name}`,
                  })),
                ],
              },
              {
                kind: "select",
                id: "status",
                group: "Milestone",
                label: "Status",
                value: values.status,
                options: [
                  { value: "", label: "Any status" },
                  ...MILESTONE_FILTER_STATUSES.map((status) => ({
                    value: status,
                    label: getStatusPresentation(status).label,
                  })),
                ],
              },
              {
                kind: "dateRange",
                id: "submitted",
                group: "Submission",
                label: "Submitted",
                from: values.submittedFromDay,
                to: values.submittedToDay,
                description: `Milestones with work submitted on these days, in the contract's time zone (${contract.timezone}).`,
              },
            ]}
            onApply={(next) =>
              update({
                quick: next.quick as MilestoneFilterValues["quick"],
                stageId: next.stage,
                status: next.status as EMilestoneStatus | "",
                submittedFromDay: next["submitted.from"],
                submittedToDay: next["submitted.to"],
              })
            }
          />
        </DataTableToolbar>
        <DataTable
          label="Milestones"
          columns={columns}
          rows={milestones.currentData?.data ?? []}
          getRowKey={(milestone) => milestone.id}
          isLoading={milestones.isLoading}
          loadingLabel="Loading milestones…"
          error={
            milestones.error
              ? getApiErrorMessage(
                  milestones.error,
                  "Unable to load the milestones.",
                )
              : null
          }
          onRetry={() => void milestones.refetch()}
          empty={
            filtered ? (
              <DataTableEmpty
                title="No milestones match these filters"
                action={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => update(NO_MILESTONE_FILTERS)}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <DataTableEmpty
                title="No milestones yet"
                description={
                  permissions.canPlan
                    ? stages.length
                      ? "Add the first milestone to one of the contract's stages."
                      : "Add a stage first; milestones are planned within stages."
                    : "The client's Client Project Manager plans the milestones."
                }
              />
            )
          }
          pagination={
            milestones.currentData
              ? {
                  meta: milestones.currentData.meta,
                  itemLabel: "milestones",
                  isFetching: milestones.isFetching,
                  onPageChange: pagination.setPage,
                  onPageSizeChange: pagination.setLimit,
                }
              : undefined
          }
        />
      </ListCard>
      <MilestoneSheet
        project={project}
        open={adding}
        stage={null}
        milestone={null}
        onClose={() => setAdding(false)}
      />
    </div>
  );
}
