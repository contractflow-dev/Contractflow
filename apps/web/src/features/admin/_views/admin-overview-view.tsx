"use client";
import {
  RiRefreshLine,
  RiAlertLine,
  RiTimeLine,
  RiCheckboxCircleLine,
} from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Separator } from "@workspace/ui/components/separator";
import { getApiErrorMessage } from "@/lib/apiError";
import { useGetAdminOverviewQuery } from "@/services/adminApi";
import { OverviewKpiGrid } from "@/features/admin/components/overview-kpi-grid";
import { ContractLifecycleCard } from "@/features/admin/components/contract-lifecycle-card";
import { AttentionItemsCard } from "@/features/admin/components/attention-items-card";
import { RecentActivityCard } from "@/features/admin/components/recent-activity-card";
import { AdminOverviewSkeleton } from "@/features/admin/components/admin-overview-skeleton";

function formatTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function AdminOverviewView() {
  const { data, error, isLoading, isFetching, refetch } =
    useGetAdminOverviewQuery(undefined, {
      refetchOnMountOrArgChange: true,
    });

  return (
    <div className="space-y-6">
      {/* Top Banner / Heading */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading">
                Platform Overview
              </h1>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs gap-1 font-medium"
              >
                <RiCheckboxCircleLine className="size-3" />
                Live Telemetry
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Aggregated metrics, tenancy operations, and system-wide contract
              oversight.
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {data?.generatedAt && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <RiTimeLine className="size-3.5" />
                <span>Synced at {formatTimestamp(data.generatedAt)}</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="gap-1.5 text-xs font-medium"
            >
              <RiRefreshLine
                className={`size-3.5 ${isFetching ? "animate-spin text-brand" : ""}`}
              />
              <span>{isFetching ? "Syncing…" : "Refresh"}</span>
            </Button>
          </div>
        </div>
        <Separator />
      </div>

      {/* Error State */}
      {error && (
        <Alert
          variant="destructive"
          className="flex flex-col justify-between gap-4 border-destructive/20 bg-destructive/5 sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
              <RiAlertLine className="size-5" />
            </div>
            <div>
              <AlertTitle className="font-semibold text-destructive">
                Failed to load platform overview
              </AlertTitle>
              <AlertDescription className="text-xs">
                {getApiErrorMessage(
                  error,
                  "An error occurred while communicating with the database or server.",
                )}
              </AlertDescription>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            className="self-start sm:self-auto text-xs shrink-0"
          >
            Retry Request
          </Button>
        </Alert>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <AdminOverviewSkeleton />
      ) : data ? (
        <div className="space-y-6">
          {/* 1. Core KPIs */}
          <OverviewKpiGrid data={data} />

          {/* 2. Contract Portfolio Lifecycle */}
          <ContractLifecycleCard contracts={data.contracts} />

          {/* 3. Operational Attention & Recent Activity */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AttentionItemsCard attention={data.attention} />
            <RecentActivityCard activity={data.recentActivity} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
