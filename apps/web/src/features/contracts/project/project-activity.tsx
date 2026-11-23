"use client";

import Link from "next/link";
import { useState } from "react";
import { RiArrowRightLine } from "@remixicon/react";
import {
  MILESTONE_ACTIVITY_ACTIONS,
  STAGE_ACTIVITY_ACTIONS,
  type ContractActivityAction,
  type ContractActivityItem,
} from "@contractflow/contracts-schema";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import {
  DataTableEmpty,
  DataTableError,
  DataTableSkeleton,
} from "@/components/data-table/data-table";
import { ListCard } from "@/components/data-table/list-card";
import { FormField } from "@/components/forms/form-field";
import { DataPagination } from "@/components/pagination/data-pagination";
import { useKeepPageInRange, usePagination } from "@/hooks/use-pagination";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDateTime } from "@/lib/format";
import { useGetContractActivityQuery } from "@/services/contractApi";
import { activityActor, activityLabel } from "../components/contract-activity";
import { contractWorkspaceHref } from "../contract-workspaces";
import { milestoneHref } from "./project-milestones";

/** Actions that carry a reason, and what that reason is. */
export function activityReasonLabel(action: string): string {
  if (action === "stage.updated" || action === "milestone.updated") {
    // A planning change records a reason only when it overrode the dates.
    return "Date override reason";
  }
  if (action === "milestone.rejected") return "Rejection reason";
  if (action === "milestone.partially_approved")
    return "Partial approval reason";
  return "Reason";
}

/** Where an entry's record is shown in the Project workspace, or null. */
export function projectActivityHref(
  contractId: string,
  entry: Pick<ContractActivityItem, "entityType" | "entityId">,
): string | null {
  if (entry.entityType === "milestone") {
    return milestoneHref(contractId, entry.entityId);
  }
  if (entry.entityType === "contract_stage") {
    return contractWorkspaceHref(contractId, "project", "stages");
  }
  return null;
}

/**
 * The Project workspace's own activity: stage and milestone changes, newest
 * first. The API returns only what members of the viewer's company did, and
 * only in workspaces the viewer holds a role in; the other side's actions
 * show in each milestone's submission and decision history.
 */
export function ProjectActivity({
  companyId,
  contractId,
  viewer,
}: {
  companyId: string;
  contractId: string;
  viewer?: { membershipId: string; companyName: string };
}) {
  const timeZone = useUserTimeZone();
  const pagination = usePagination(10);
  const [action, setAction] = useState<ContractActivityAction | "">("");
  const activity = useGetContractActivityQuery({
    companyId,
    contractId,
    page: pagination.page,
    limit: pagination.limit,
    workspace: "project",
    action: action || undefined,
  });
  useKeepPageInRange(activity.currentData?.meta, pagination.setPage);
  const data = activity.currentData;

  return (
    <ListCard
      title="Project activity"
      description="Stage and milestone changes made by your company, newest first. Each milestone's history also shows the other side's submissions and decisions."
    >
      <div className="max-w-sm">
        <FormField id="project-activity-action" label="Action">
          {(control) => (
            <NativeSelect
              {...control}
              className="w-full"
              value={action}
              onChange={(event) => {
                setAction(event.target.value as ContractActivityAction | "");
                pagination.resetPage();
              }}
            >
              <NativeSelectOption value="">All actions</NativeSelectOption>
              <NativeSelectOptGroup label="Stages">
                {STAGE_ACTIVITY_ACTIONS.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {activityLabel(value)}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
              <NativeSelectOptGroup label="Milestones">
                {MILESTONE_ACTIVITY_ACTIONS.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {activityLabel(value)}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            </NativeSelect>
          )}
        </FormField>
      </div>
      {activity.error ? (
        <DataTableError
          message={getApiErrorMessage(
            activity.error,
            "Unable to load the activity.",
          )}
          onRetry={() => void activity.refetch()}
        />
      ) : activity.isLoading ? (
        <DataTableSkeleton
          label="Loading activity…"
          columns={["Activity"]}
          rows={3}
        />
      ) : data && data.data.length ? (
        <div className="space-y-4">
          <ol
            aria-label="Project activity"
            className="divide-y rounded-xl border"
          >
            {data.data.map((entry) => {
              const href = projectActivityHref(contractId, entry);
              const label = activityLabel(entry.action);
              return (
                <li key={entry.id} className="space-y-1 p-4">
                  <p className="text-sm font-medium">{label}</p>
                  {entry.summary ? (
                    <p className="text-sm break-words text-muted-foreground">
                      {entry.summary}
                    </p>
                  ) : null}
                  {entry.reason ? (
                    <p className="text-sm break-words">
                      <span className="font-medium">
                        {activityReasonLabel(entry.action)}:{" "}
                      </span>
                      <span className="whitespace-pre-line">
                        {entry.reason}
                      </span>
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {activityActor(entry, viewer)} ·{" "}
                    <time dateTime={entry.occurredAt}>
                      {formatDateTime(entry.occurredAt, { timeZone })}
                    </time>
                  </p>
                  {href ? (
                    <Link
                      href={href}
                      aria-label={`Open: ${label}`}
                      className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                    >
                      {entry.entityType === "milestone"
                        ? "Open milestone"
                        : "Open stages"}
                      <RiArrowRightLine
                        aria-hidden="true"
                        className="size-3.5"
                      />
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <DataPagination
            meta={data.meta}
            itemLabel="activity records"
            isFetching={activity.isFetching}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setLimit}
          />
        </div>
      ) : (
        <DataTableEmpty
          title={
            action ? "No activity of this kind" : "No project activity yet"
          }
          description="Stage and milestone changes your company makes appear here."
        />
      )}
    </ListCard>
  );
}
