"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  RiArrowRightLine,
  RiBarChart2Line,
  RiFileList3Line,
  RiFileTextLine,
  RiMoneyDollarCircleLine,
  RiRefreshLine,
  RiSettings3Line,
  RiShieldCheckLine,
  RiUserAddLine,
} from "@remixicon/react";
import {
  ECompanyDepartment,
  type ICompanyDashboardResponse,
} from "@contractflow/contracts-schema";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@/components/status-badge/status-badge";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  daysUntilCalendarDate,
  formatCalendarDate,
  formatDate,
  formatNumber,
  resolveTimeZone,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useGetCompanyDashboardQuery } from "@/features/companies";
import { useGetCurrentUserQuery } from "@/services/authApi";
import { CompanyAdminShell } from "@/features/companies/CompanyAdminShell";
import { CompanyVerificationNotice } from "@/features/companies/company-verification-notice";
import { departmentHref } from "@/features/companies/company-navigation";
import { TEAM_PATH } from "@/features/companies/company-navigation";
import { departmentStaffingHref } from "@/features/companies/departments";
import { NEW_CONTRACT_PATH } from "@/features/contracts/contract-sections";
import { IncomingContractInvitations } from "@/features/contracts/components/incoming-contract-invitations";

/** The Team page with its Invite member dialog open. */
const TEAM_INVITE_HREF = `${TEAM_PATH}?dialog=invite`;

export function CompanyDashboardView() {
  return (
    <CompanyAdminShell>
      {(access) => (
        <div className="space-y-6">
          <CompanyVerificationNotice company={access.company} />
          <DashboardContent companyId={access.company.id} />
        </div>
      )}
    </CompanyAdminShell>
  );
}

function DashboardContent({ companyId }: { companyId: string }) {
  const {
    currentData: data,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useGetCompanyDashboardQuery(
    { companyId },
    { refetchOnMountOrArgChange: true },
  );
  const { data: user } = useGetCurrentUserQuery();
  const timeZone = useUserTimeZone();
  const firstTime = data?.summary.totalContractCount === 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="type-page-title">
            {greeting(timeZone)}
            {user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="mt-1 max-w-2xl type-lead">
            {firstTime
              ? "Welcome to your ContractFlow workspace. Let’s get your contract operations up and running."
              : "Here’s where your contracts stand today."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="self-start gap-2 sm:self-auto"
        >
          <RiRefreshLine
            className={cn("size-4", isFetching && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      {/* After the page heading, so the outline stays <h1> then <h2>. */}
      <IncomingContractInvitations companyId={companyId} />

      {isLoading ? (
        <div
          role="status"
          aria-label="Loading company dashboard"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Alert
          variant="destructive"
          className="sm:flex sm:items-center sm:justify-between sm:gap-4"
        >
          <div>
            <AlertTitle>Dashboard data could not be loaded</AlertTitle>
            <AlertDescription>
              {getApiErrorMessage(error, "Please retry the request.")}
            </AlertDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => void refetch()}
            className="mt-3 self-start sm:mt-0 sm:self-auto"
          >
            Retry
          </Button>
        </Alert>
      ) : data ? (
        <>
          <PortfolioHealth data={data} />
          <DepartmentWorkspaces data={data} />
          <QuickActions data={data} />
          <RecentActivity data={data} timeZone={timeZone} />
          <EndingSoon data={data} />
        </>
      ) : null}
    </div>
  );
}

function SectionHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-3">
      <h2 id={id} className="type-section-title">
        {title}
      </h2>
      <p className="type-lead">{description}</p>
    </div>
  );
}

function PortfolioHealth({ data }: { data: ICompanyDashboardResponse }) {
  const health = data.portfolioHealth;
  const tiles = [
    {
      label: "Active contracts",
      value: data.summary.activeContractCount,
      description: "Contracts in progress, across all departments.",
      risk: false,
    },
    {
      label: "Stalled contracts",
      value: health.stalledContractCount,
      description: `Active, with no recorded change in ${health.stalledAfterDays}+ days.`,
      risk: true,
    },
    {
      label: "Non-compliant contractors",
      value: health.nonCompliantContractorCount,
      description: "With an expired, rejected or non-compliant record.",
      risk: true,
    },
    {
      label: "Payments overdue",
      value: health.overduePaymentCount,
      description: "Unpaid invoices past their due date.",
      risk: true,
    },
  ];
  return (
    <section aria-labelledby="portfolio-heading">
      <SectionHeading
        id="portfolio-heading"
        title="Portfolio health"
        description="What’s holding up progress across your contracts, plus payment and compliance risk."
      />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Card highlight className="h-full">
              <CardContent className="space-y-1">
                <p
                  className={cn(
                    "font-heading text-3xl font-semibold tabular-nums",
                    tile.risk && tile.value > 0
                      ? // Red reads poorly on the flipped card; the label says what it is.
                        "text-destructive-soft-foreground group-hover/card:text-card-foreground"
                      : "text-foreground",
                  )}
                >
                  {formatNumber(tile.value)}
                </p>
                <p className="text-sm font-medium">{tile.label}</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {tile.description}
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DepartmentWorkspaces({ data }: { data: ICompanyDashboardResponse }) {
  const departments: Array<{
    name: string;
    icon: ComponentType<{ className?: string }>;
    tint: string;
    /** The first is the card's headline figure; any others follow it. */
    figures: Array<{ value: number; label: string }>;
    /** Team → Contract roles for the department's workspace (D1). */
    staffingHref: string;
    /** The department's oversight page. */
    overviewHref: string;
  }> = [
    {
      // One Project department for both sides, as in the sidebar.
      name: "Project",
      icon: RiBarChart2Line,
      tint: "bg-dept-client-pm/15 text-dept-client-pm",
      figures: [
        {
          value: data.departments.contractsNeedingAttentionCount,
          label: "Contracts needing attention",
        },
      ],
      staffingHref: departmentStaffingHref(ECompanyDepartment.PROJECT),
      overviewHref: departmentHref("project"),
    },
    {
      name: "HSE",
      icon: RiShieldCheckLine,
      tint: "bg-dept-hse/15 text-dept-hse",
      // Compliance records belong to the HSE workspace.
      figures: [
        { value: data.departments.openIncidentCount, label: "Open incidents" },
        {
          value: data.departments.complianceAttentionCount,
          label: "Compliance records needing attention",
        },
      ],
      staffingHref: departmentStaffingHref(ECompanyDepartment.HSE),
      overviewHref: departmentHref("hse"),
    },
    {
      name: "Finance",
      icon: RiMoneyDollarCircleLine,
      tint: "bg-dept-finance/15 text-dept-finance",
      figures: [
        {
          value: data.departments.invoicesDueSoonCount,
          label: `Invoices due in the next ${data.departments.dueWindowDays} days`,
        },
      ],
      staffingHref: departmentStaffingHref(ECompanyDepartment.FINANCE),
      overviewHref: departmentHref("finance"),
    },
  ];
  return (
    <section aria-labelledby="departments-heading">
      <SectionHeading
        id="departments-heading"
        title="Department workspaces"
        description="Each department sees your contracts through its own lens."
      />
      <ul className="grid gap-4 md:grid-cols-3">
        {departments.map(
          ({
            name,
            icon: Icon,
            tint,
            figures: [headline, ...more],
            staffingHref,
            overviewHref,
          }) => (
            <li key={name}>
              <Card highlight className="h-full">
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "grid size-9 place-items-center rounded-xl",
                        tint,
                      )}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="type-subsection-title">{name}</h3>
                  </div>
                  <div>
                    <p className="font-heading text-2xl font-semibold tabular-nums">
                      {formatNumber(headline.value)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {headline.label}
                    </p>
                  </div>
                  {more.map((figure) => (
                    <div key={figure.label}>
                      <p className="text-base font-semibold tabular-nums">
                        {formatNumber(figure.value)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {figure.label}
                      </p>
                    </div>
                  ))}
                  <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1">
                    <Link
                      href={staffingHref}
                      aria-label={`Manage ${name} staffing`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 group-hover/card:text-card-foreground group-hover/card:underline hover:underline"
                    >
                      Manage staffing
                      <RiArrowRightLine className="size-4" aria-hidden="true" />
                    </Link>
                    <Link
                      href={overviewHref}
                      aria-label={`View ${name} contracts`}
                      className="text-sm font-medium text-primary underline-offset-4 group-hover/card:text-card-foreground group-hover/card:underline hover:underline"
                    >
                      View contracts
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function QuickActions({ data }: { data: ICompanyDashboardResponse }) {
  const { activeMembershipCount, pendingInvitationCount } = data.summary;
  return (
    <section aria-labelledby="quick-actions-heading">
      <SectionHeading
        id="quick-actions-heading"
        title="Quick actions"
        description="Common next steps for your company."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card highlight>
          <CardContent className="flex h-full flex-col gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground">
              <RiFileList3Line className="size-5" aria-hidden="true" />
            </span>
            <h3 className="font-heading text-base font-semibold">
              Create a contract
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Set up a contract with its parties, commercial terms and
              department workspaces. Each workspace sees it as soon as it’s
              created.
            </p>
            <Link
              href={NEW_CONTRACT_PATH}
              className={cn(buttonVariants(), "mt-auto self-start")}
            >
              Create a contract
            </Link>
          </CardContent>
        </Card>

        <Card highlight>
          <CardContent className="flex h-full flex-col gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground">
              <RiUserAddLine className="size-5" aria-hidden="true" />
            </span>
            <h3 className="font-heading text-base font-semibold">
              Invite your team
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Add people, then give each one a role on the contracts and
              workspaces they need. {formatNumber(activeMembershipCount)} member
              {activeMembershipCount === 1 ? "" : "s"},{" "}
              {formatNumber(pendingInvitationCount)} pending invitation
              {pendingInvitationCount === 1 ? "" : "s"}.
            </p>
            <Link
              href={TEAM_INVITE_HREF}
              className="mt-auto inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary underline-offset-4 group-hover/card:text-card-foreground group-hover/card:underline hover:underline"
            >
              Invite members
              <RiArrowRightLine className="size-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>

        <Card highlight>
          <CardContent className="flex h-full flex-col gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground group-hover/card:bg-card-foreground/10 group-hover/card:text-card-foreground">
              <RiSettings3Line className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-base font-semibold">
                Configure contract stages
              </h3>
              <Badge variant="secondary">Planned</Badge>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Choosing the stages your contracts move through, from bid to
              commissioning, isn’t available yet.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function RecentActivity({
  data,
  timeZone,
}: {
  data: ICompanyDashboardResponse;
  timeZone?: string;
}) {
  const noContracts = data.summary.totalContractCount === 0;
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>
          <h2>Recent activity</h2>
        </CardTitle>
        {noContracts ? null : (
          <CardDescription>
            Contracts updated in the last 30 days, newest first.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {noContracts ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <RiFileTextLine className="size-5" aria-hidden="true" />
            </span>
            <h3 className="font-semibold">No contracts yet</h3>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Once you create a contract, its status, parties and updates show
              here and in every department workspace.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href={NEW_CONTRACT_PATH} className={buttonVariants()}>
                Create a contract
              </Link>
              <Link
                href={TEAM_INVITE_HREF}
                className={buttonVariants({ variant: "outline" })}
              >
                Invite your team
              </Link>
            </div>
          </div>
        ) : data.recentlyUpdatedContracts.length ? (
          <ul className="divide-y">
            {data.recentlyUpdatedContracts.map((contract) => (
              <li
                key={contract.id}
                className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
              >
                <div className="min-w-0">
                  <Link
                    href={contractHref(contract.id)}
                    className="font-medium break-words text-primary underline-offset-4 hover:underline"
                  >
                    {contract.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {contract.referenceNumber} · End date:{" "}
                    {formatEndDate(contract.endDate)}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-1 sm:items-end sm:text-end">
                  <StatusBadge status={contract.status} />
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={contract.updatedAt}
                  >
                    Updated{" "}
                    {formatDate(contract.updatedAt, {
                      timeZone,
                      fallback: "Date not available",
                    })}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-3 text-sm text-muted-foreground">
            No contracts have been updated in the last 30 days.
          </p>
        )}
        {noContracts ? null : (
          <Link
            href="/dashboards/contracts"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View all contracts
            <RiArrowRightLine className="size-4" aria-hidden="true" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function EndingSoon({ data }: { data: ICompanyDashboardResponse }) {
  if (data.summary.totalContractCount === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Contracts ending soon</h2>
        </CardTitle>
        <CardDescription>
          Active contracts ending in the next {data.expiryWindowDays} days.
          Showing up to five, soonest first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.expiringContracts.length ? (
          <ul className="divide-y">
            {data.expiringContracts.map((contract) => (
              <li
                key={contract.id}
                className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
              >
                <div className="min-w-0">
                  <Link
                    href={contractHref(contract.id)}
                    className="font-medium break-words text-primary underline-offset-4 hover:underline"
                  >
                    {contract.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {contract.referenceNumber}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-1 sm:items-end sm:text-end">
                  <StatusBadge status={contract.status} />
                  <span className="text-xs text-muted-foreground">
                    {daysUntil(contract.endDate)} ·{" "}
                    <time dateTime={contract.endDate ?? undefined}>
                      {formatEndDate(contract.endDate)}
                    </time>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-3 text-sm text-muted-foreground">
            {data.summary.activeContractCount === 0
              ? "There are no active contracts for this company."
              : `No active contracts end within the next ${data.expiryWindowDays} days.`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** "Good morning" / "Good afternoon" / "Good evening" in the user's time zone. */
export function greeting(timeZone?: string, now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: resolveTimeZone(timeZone),
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function contractHref(contractId: string): string {
  return `/dashboards/contracts/${encodeURIComponent(contractId)}`;
}

function formatEndDate(value: string | null): string {
  return formatCalendarDate(value, { fallback: "Date not available" });
}

function daysUntil(value: string | null): string {
  const days = daysUntilCalendarDate(value);
  if (days === null) return "End date unavailable";
  const remaining = Math.max(0, days);
  return remaining === 0
    ? "Ends today"
    : `Ends in ${remaining} day${remaining === 1 ? "" : "s"}`;
}
