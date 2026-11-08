import React from "react";
import {
  RiFileTextLine,
  RiTimeLine,
  RiPauseCircleLine,
  RiCheckboxCircleLine,
  RiAlarmWarningLine,
} from "@remixicon/react";
import type { IAdminContractMetrics } from "@contractflow/contracts-schema";
import { Badge } from "@workspace/ui/components/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { formatNumber, formatPercent } from "@/lib/format";

interface ContractLifecycleCardProps {
  contracts: IAdminContractMetrics;
}

export function ContractLifecycleCard({ contracts }: ContractLifecycleCardProps) {
  const total = contracts.total || 1;
  // Whole percentages for the bar widths; the labels use formatPercent.
  const activePercent = Math.round((contracts.active / total) * 100);
  const draftPercent = Math.round((contracts.draft / total) * 100);
  const completedPercent = Math.round((contracts.completed / total) * 100);
  const suspendedPercent = Math.round((contracts.suspended / total) * 100);

  // Colours follow the status badge tones (active = success, draft = neutral,
  // completed = info, suspended = warning), so a status looks the same here
  // as in contract lists. Each count card repeats its segment's swatch.
  const statuses = [
    {
      label: "Active",
      count: contracts.active,
      percentage: activePercent,
      color: "bg-success",
      iconColor: "bg-success-soft text-success-soft-foreground",
      icon: RiFileTextLine,
    },
    {
      label: "Draft",
      count: contracts.draft,
      percentage: draftPercent,
      color: "bg-muted-foreground",
      iconColor: "bg-secondary text-secondary-foreground",
      icon: RiTimeLine,
    },
    {
      label: "Completed",
      count: contracts.completed,
      percentage: completedPercent,
      color: "bg-info",
      iconColor: "bg-info-soft text-info-soft-foreground",
      icon: RiCheckboxCircleLine,
    },
    {
      label: "Suspended",
      count: contracts.suspended,
      percentage: suspendedPercent,
      color: "bg-warning",
      iconColor: "bg-warning-soft text-warning-soft-foreground",
      icon: RiPauseCircleLine,
    },
  ];
  const distributionLabel = `Contract status distribution: ${statuses
    .map(
      (item) =>
        `${item.label} ${formatNumber(item.count)} (${formatPercent(item.percentage / 100)})`,
    )
    .join(", ")}.`;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle
          role="heading"
          aria-level={2}
          className="text-base font-semibold tracking-tight"
        >
          Contract Portfolio Lifecycle
        </CardTitle>
        <CardDescription className="text-xs">
          Operational status distribution across all registered tenant contracts
        </CardDescription>
        {contracts.expiringSoon > 0 && (
          <CardAction>
            <Badge variant="destructive" className="h-auto gap-1.5 px-3 py-1">
              <RiAlarmWarningLine className="size-3.5" />
              <span>{contracts.expiringSoon} Expiring within 30 days</span>
            </Badge>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
      {/* Aggregate Bar: multi-segment, so Progress (single value) does not fit */}
      {/* The counts below carry the same data as text; the bar is a summary. */}
      <div
        role="img"
        aria-label={distributionLabel}
        // A 1px gap of track colour separates adjacent segments, so they can
        // be told apart without relying on their colours.
        className="flex h-3 w-full gap-px overflow-hidden rounded-full bg-muted"
      >
        {statuses.map((item) =>
          item.count > 0 ? (
            <div
              key={item.label}
              data-segment={item.label.toLowerCase()}
              style={{ width: `${item.percentage}%` }}
              className={`${item.color} transition-all motion-reduce:transition-none`}
              title={`${item.label}: ${formatNumber(item.count)}`}
            />
          ) : null,
        )}
      </div>

      {/* Detailed Status Breakdown */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statuses.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
              size="sm"
              className="justify-between gap-3 border bg-background/50 shadow-none ring-0"
            >
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <span
                      aria-hidden="true"
                      data-swatch={item.label.toLowerCase()}
                      className={`size-2.5 shrink-0 rounded-full ${item.color}`}
                    />
                    {item.label}
                  </span>
                  <div
                    aria-hidden="true"
                    className={`grid size-6 place-items-center rounded-md ${item.iconColor}`}
                  >
                    <Icon className="size-3.5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="font-heading text-xl font-semibold tracking-tight text-foreground tabular-nums">
                    {formatNumber(item.count)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatPercent(item.percentage / 100)}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      </CardContent>
    </Card>
  );
}
