import React from "react";
import {
  RiFileTextLine,
  RiTimeLine,
  RiPauseCircleLine,
  RiCheckboxCircleLine,
  RiAlarmWarningLine,
} from "@remixicon/react";
import type { AdminContractMetrics } from "@/services/adminApi";
import { Badge } from "@workspace/ui/components/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

interface ContractLifecycleCardProps {
  contracts: AdminContractMetrics;
}

export function ContractLifecycleCard({ contracts }: ContractLifecycleCardProps) {
  const total = contracts.total || 1;
  const activePercent = Math.round((contracts.active / total) * 100);
  const draftPercent = Math.round((contracts.draft / total) * 100);
  const completedPercent = Math.round((contracts.completed / total) * 100);
  const suspendedPercent = Math.round((contracts.suspended / total) * 100);

  const statuses = [
    {
      label: "Active Operations",
      count: contracts.active,
      percentage: activePercent,
      color: "bg-emerald-500",
      textColor: "text-emerald-700 dark:text-emerald-400",
      bgColor: "bg-emerald-500/10",
      icon: RiFileTextLine,
    },
    {
      label: "Drafting & Review",
      count: contracts.draft,
      percentage: draftPercent,
      color: "bg-blue-500",
      textColor: "text-blue-700 dark:text-blue-400",
      bgColor: "bg-blue-500/10",
      icon: RiTimeLine,
    },
    {
      label: "Completed & Archived",
      count: contracts.completed,
      percentage: completedPercent,
      color: "bg-purple-500",
      textColor: "text-purple-700 dark:text-purple-400",
      bgColor: "bg-purple-500/10",
      icon: RiCheckboxCircleLine,
    },
    {
      label: "Suspended",
      count: contracts.suspended,
      percentage: suspendedPercent,
      color: "bg-amber-500",
      textColor: "text-amber-700 dark:text-amber-400",
      bgColor: "bg-amber-500/10",
      icon: RiPauseCircleLine,
    },
  ];

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
      <div className="space-y-2">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {contracts.active > 0 && (
            <div
              style={{ width: `${activePercent}%` }}
              className="bg-emerald-500 transition-all"
              title={`Active: ${contracts.active}`}
            />
          )}
          {contracts.draft > 0 && (
            <div
              style={{ width: `${draftPercent}%` }}
              className="bg-blue-500 transition-all"
              title={`Draft: ${contracts.draft}`}
            />
          )}
          {contracts.completed > 0 && (
            <div
              style={{ width: `${completedPercent}%` }}
              className="bg-purple-500 transition-all"
              title={`Completed: ${contracts.completed}`}
            />
          )}
          {contracts.suspended > 0 && (
            <div
              style={{ width: `${suspendedPercent}%` }}
              className="bg-amber-500 transition-all"
              title={`Suspended: ${contracts.suspended}`}
            />
          )}
        </div>
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
                  <span className="text-xs font-medium text-muted-foreground">
                    {item.label}
                  </span>
                  <div className={`grid size-6 place-items-center rounded-md ${item.bgColor} ${item.textColor}`}>
                    <Icon className="size-3.5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-xl font-bold tracking-tight text-foreground">
                    {item.count}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.percentage}%
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
