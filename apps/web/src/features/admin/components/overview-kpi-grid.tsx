import React from "react";
import {
  RiBuilding4Line,
  RiGroupLine,
  RiFileList3Line,
  RiMailSendLine,
  RiShieldUserLine,
  RiTimeLine,
  RiAlertLine,
  RiCheckLine,
} from "@remixicon/react";
import { Badge } from "@workspace/ui/components/badge";
import { Card } from "@workspace/ui/components/card";
import type { AdminOverviewResponse } from "@/services/adminApi";

interface OverviewKpiGridProps {
  data: AdminOverviewResponse;
}

export function OverviewKpiGrid({ data }: OverviewKpiGridProps) {
  const { companies, users, contracts, invitations } = data;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Companies KPI */}
      <Card className="justify-between gap-0 px-5 transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tenant Companies
          </span>
          <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <RiBuilding4Line className="size-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">
              {companies.total.toLocaleString()}
            </span>
            {companies.newThisMonth > 0 && (
              <Badge variant="secondary" className="text-xs font-normal">
                +{companies.newThisMonth} this month
              </Badge>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {companies.active} active
            </span>
            <span>•</span>
            <span>{companies.inactive} inactive</span>
          </div>
        </div>
      </Card>

      {/* Users KPI */}
      <Card className="justify-between gap-0 px-5 transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Registered Users
          </span>
          <div className="grid size-9 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <RiGroupLine className="size-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">
              {users.total.toLocaleString()}
            </span>
            <Badge variant="outline" className="gap-1 text-xs">
              <RiShieldUserLine className="size-3 text-brand" />
              {users.platformAdmins} admin{users.platformAdmins === 1 ? "" : "s"}
            </Badge>
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {users.active} active
            </span>
            <span>•</span>
            <span className="text-amber-600 dark:text-amber-400">
              {users.pendingVerification} unverified
            </span>
          </div>
        </div>
      </Card>

      {/* Contracts KPI */}
      <Card className="justify-between gap-0 px-5 transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Contracts
          </span>
          <div className="grid size-9 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <RiFileList3Line className="size-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">
              {contracts.total.toLocaleString()}
            </span>
            {contracts.expiringSoon > 0 ? (
              <Badge variant="destructive" className="gap-1 text-xs">
                <RiAlertLine className="size-3" />
                {contracts.expiringSoon} expiring
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs font-normal">
                {contracts.active} active
              </Badge>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {contracts.active} active
            </span>
            <span>•</span>
            <span>{contracts.draft} draft</span>
            <span>•</span>
            <span>{contracts.completed} completed</span>
          </div>
        </div>
      </Card>

      {/* Invitations KPI */}
      <Card className="justify-between gap-0 px-5 transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Invitations
          </span>
          <div className="grid size-9 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <RiMailSendLine className="size-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">
              {invitations.total.toLocaleString()}
            </span>
            {invitations.pending > 0 && (
              <Badge variant="secondary" className="gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                <RiTimeLine className="size-3" />
                {invitations.pending} pending
              </Badge>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <RiCheckLine className="size-3" />
              {invitations.accepted} accepted
            </span>
            <span>•</span>
            <span>{invitations.declined} declined</span>
            {invitations.expired > 0 && (
              <>
                <span>•</span>
                <span className="text-destructive">{invitations.expired} expired</span>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
