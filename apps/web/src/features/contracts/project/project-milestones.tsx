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
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import {
  DataTable,
  DataTableEmpty,
  type DataTableColumn,
} from "@/components/data-table/data-table";
import {
  DataTableActiveFilters,
  DataTableFilterChips,
  DataTableMoreFilters,
  DataTableToolbar,
  type ActiveFilter,
} from "@/components/data-table/data-table-toolbar";
import { ListCard } from "@/components/data-table/list-card";
import { FormField, FormGrid } from "@/components/forms/form-field";
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
  const { filters, rangeError } = toMilestoneQueryFilters(
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

  const active: ActiveFilter[] = [];
  if (values.stageId) {
    active.push({
      key: "stage",
      label: `Stage: ${stageName(values.stageId) ?? "selected"}`,
      onRemove: () => update({ stageId: "" }),
    });
  }
  if (values.status) {
    active.push({
      key: "status",
      label: `Status: ${getStatusPresentation(values.status).label}`,
      onRemove: () => update({ status: "" }),
    });
  }
  if (values.submittedFromDay || values.submittedToDay) {
    active.push({
      key: "submitted",
      label: `Submitted ${
        values.submittedFromDay
          ? `from ${formatCalendarDate(values.submittedFromDay)}`
          : ""
      }${values.submittedFromDay && values.submittedToDay ? " " : ""}${
        values.submittedToDay
          ? `to ${formatCalendarDate(values.submittedToDay)}`
          : ""
      }`,
      onRemove: () => update({ submittedFromDay: "", submittedToDay: "" }),
    });
  }
  const filtered = values.quick !== "all" || active.length > 0;

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
        <DataTableFilterChips
          label="Show"
          countNoun="milestones"
          value={values.quick}
          onChange={(quick) => update({ quick })}
          options={[
            { value: "all", label: "All" },
            { value: "pendingReview", label: "Awaiting review" },
            { value: "overdue", label: "Overdue" },
          ]}
        />
        <DataTableToolbar>
          <FormGrid columns={2} className="w-full max-w-xl">
            <FormField id="milestone-filter-stage" label="Stage">
              {(control) => (
                <NativeSelect
                  {...control}
                  className="w-full"
                  value={values.stageId}
                  onChange={(event) => update({ stageId: event.target.value })}
                >
                  <NativeSelectOption value="">All stages</NativeSelectOption>
                  {stages.map((stage) => (
                    <NativeSelectOption key={stage.id} value={stage.id}>
                      {stage.sequence}. {stage.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="milestone-filter-status" label="Status">
              {(control) => (
                <NativeSelect
                  {...control}
                  className="w-full"
                  value={values.status}
                  onChange={(event) =>
                    update({
                      status: event.target.value as EMilestoneStatus | "",
                    })
                  }
                >
                  <NativeSelectOption value="">Any status</NativeSelectOption>
                  {MILESTONE_FILTER_STATUSES.map((status) => (
                    <NativeSelectOption key={status} value={status}>
                      {getStatusPresentation(status).label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          </FormGrid>
          <div className="sm:self-end">
            <DataTableMoreFilters
              activeCount={
                values.submittedFromDay || values.submittedToDay ? 1 : 0
              }
              onClear={() =>
                update({ submittedFromDay: "", submittedToDay: "" })
              }
            >
              <p className="text-xs text-muted-foreground">
                Milestones with work submitted on these days, in the
                contract&apos;s time zone ({contract.timezone}).
              </p>
              <FormGrid columns={2}>
                <FormField
                  id="milestone-filter-submitted-from"
                  label="Submitted from"
                >
                  {(control) => (
                    <Input
                      {...control}
                      type="date"
                      value={values.submittedFromDay}
                      onChange={(event) =>
                        update({ submittedFromDay: event.target.value })
                      }
                    />
                  )}
                </FormField>
                <FormField
                  id="milestone-filter-submitted-to"
                  label="Submitted to"
                  error={rangeError ?? undefined}
                >
                  {(control) => (
                    <Input
                      {...control}
                      type="date"
                      value={values.submittedToDay}
                      onChange={(event) =>
                        update({ submittedToDay: event.target.value })
                      }
                    />
                  )}
                </FormField>
              </FormGrid>
            </DataTableMoreFilters>
          </div>
        </DataTableToolbar>
        <DataTableActiveFilters
          filters={active}
          onClearAll={() =>
            update({ ...NO_MILESTONE_FILTERS, quick: values.quick })
          }
        />
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
