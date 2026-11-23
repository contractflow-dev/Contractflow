"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { EMilestoneStatus, EStatus } from "@contractflow/contracts-schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { DataTableError } from "@/components/data-table/data-table";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatCalendarDate, formatNumber } from "@/lib/format";
import {
  useGetContractStagesQuery,
  useGetMilestonesQuery,
} from "@/services/deliveryApi";
import { contractWorkspaceHref } from "../contract-workspaces";
import { milestoneHref } from "./project-milestones";
import { addDays, contractToday, FULL_BPS } from "./project-rules";
import {
  BpsMeter,
  MilestoneStatus,
  ProjectStatusNotice,
  type ProjectContext,
} from "./project-ui";

/** The overview's look-ahead for upcoming deadlines, in days. */
export const UPCOMING_DAYS = 14;

/**
 * Overall progress from the API's stage figures: each stage's approved
 * progress weighted by its share of the contract. Stage weights may add up
 * to less than 100% while planning is unfinished.
 */
export function overallProgressBps(
  stages: ReadonlyArray<{ weightBps: number; progressBps: number }>,
): number {
  return Math.floor(
    stages.reduce(
      (sum, stage) => sum + stage.weightBps * stage.progressBps,
      0,
    ) / FULL_BPS,
  );
}

/**
 * The Project workspace at a glance: progress, stages, and the milestones
 * that need attention. Every figure is an API total or computed from the
 * API's stage figures; approval never implies invoicing, which the API
 * doesn't report here.
 */
export function ProjectOverview({ project }: { project: ProjectContext }) {
  const { companyId, contractId, contract, permissions } = project;
  const scope = { companyId, contractId };
  const today = contractToday(contract.timezone);
  const stages = useGetContractStagesQuery({ ...scope, page: 1, limit: 100 });
  const count = { ...scope, page: 1, limit: 1 };
  const all = useGetMilestonesQuery(count);
  const approved = useGetMilestonesQuery({
    ...count,
    status: EMilestoneStatus.APPROVED,
  });
  const awaiting = useGetMilestonesQuery({ ...count, pendingReview: true });
  const overdue = useGetMilestonesQuery({ ...count, overdue: true });
  const upcoming = useGetMilestonesQuery({
    ...scope,
    page: 1,
    limit: 5,
    dueFrom: today,
    dueTo: addDays(today, UPCOMING_DAYS),
  });

  const stageList = stages.currentData?.data ?? [];
  const complete =
    !!stages.currentData &&
    stages.currentData.meta.totalItems === stageList.length;
  const total = (query: { currentData?: { meta: { totalItems: number } } }) =>
    query.currentData?.meta.totalItems;
  const href = (view: "stages" | "milestones" | "reviews") =>
    contractWorkspaceHref(contractId, "project", view);

  if (stages.error) {
    return (
      <DataTableError
        message={getApiErrorMessage(
          stages.error,
          "Unable to load the project overview.",
        )}
        onRetry={() => void stages.refetch()}
      />
    );
  }

  return (
    <section aria-labelledby="project-overview-heading" className="space-y-4">
      <h2 id="project-overview-heading" className="sr-only">
        Project overview
      </h2>
      <ProjectStatusNotice notice={permissions.statusNotice} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>
              <h3>Approved progress</h3>
            </CardTitle>
            <CardDescription>
              Each stage&apos;s client-approved progress, weighted by its share
              of the contract.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stages.isLoading ? (
              <Skeleton className="h-6 w-full" />
            ) : complete ? (
              <BpsMeter
                value={overallProgressBps(stageList)}
                label="Contract"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Shown when all stages fit on one page.
              </p>
            )}
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Stages"
            value={total(stages)}
            href={href("stages")}
            detail={
              complete
                ? `${stageList.filter(({ status }) => status === EStatus.COMPLETED).length} completed · ${stageList.filter(({ status }) => status === EStatus.IN_PROGRESS).length} in progress`
                : undefined
            }
          />
          <Stat
            label="Milestones"
            value={total(all)}
            href={href("milestones")}
            detail={
              total(approved) !== undefined
                ? `${formatNumber(total(approved))} approved`
                : undefined
            }
          />
          <Stat
            label="Awaiting review"
            value={total(awaiting)}
            href={permissions.isPlanner ? href("reviews") : href("milestones")}
          />
          <Stat
            label="Overdue"
            value={total(overdue)}
            href={href("milestones")}
            tone={total(overdue) ? "danger" : undefined}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h3>Due in the next {UPCOMING_DAYS} days</h3>
          </CardTitle>
          <CardDescription>
            From today in the contract&apos;s time zone ({contract.timezone}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : upcoming.error ? (
            <DataTableError
              message={getApiErrorMessage(
                upcoming.error,
                "Unable to load upcoming milestones.",
              )}
              onRetry={() => void upcoming.refetch()}
            />
          ) : upcoming.currentData?.data.length ? (
            <ul className="divide-y rounded-xl border">
              {upcoming.currentData.data.map((milestone) => (
                <li
                  key={milestone.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <Link
                    href={milestoneHref(contractId, milestone.id)}
                    className="min-w-0 font-medium break-words text-primary underline-offset-4 hover:underline"
                  >
                    {milestone.title}
                  </Link>
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <MilestoneStatus milestone={milestone} />
                    <span className="text-muted-foreground">
                      Due{" "}
                      {formatCalendarDate(
                        milestone.revisedDueDate ?? milestone.dueDate,
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No milestones are due in the next {UPCOMING_DAYS} days.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function Stat({
  label,
  value,
  href,
  detail,
  tone,
}: {
  label: string;
  value: number | undefined;
  href: string;
  detail?: ReactNode;
  tone?: "danger";
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-2xl border bg-card p-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={
          tone === "danger" && value
            ? "text-2xl font-semibold text-destructive tabular-nums"
            : "text-2xl font-semibold tabular-nums"
        }
      >
        {value === undefined ? "…" : formatNumber(value)}
      </span>
      {detail ? (
        <span className="text-xs text-muted-foreground">{detail}</span>
      ) : null}
    </Link>
  );
}
