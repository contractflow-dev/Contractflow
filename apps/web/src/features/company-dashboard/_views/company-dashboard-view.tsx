"use client";

import Link from "next/link";
import {
  RiAlertLine,
  RiFileList3Line,
  RiGroupLine,
  RiMailLine,
  RiRefreshLine,
  RiShieldUserLine,
} from "@remixicon/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
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
import { getApiErrorMessage } from "@/lib/apiError";
import { useGetCompanyDashboardQuery } from "@/features/companies";
import { useGetCurrentUserQuery } from "@/services/authApi";
import { CompanyAdminShell } from "@/features/companies/CompanyAdminShell";

const summaryCards = [
  {
    key: "activeMembershipCount",
    label: "Active members",
    description: "Current company memberships",
    icon: RiGroupLine,
  },
  {
    key: "pendingInvitationCount",
    label: "Pending invitations",
    description: "Invitations that have not expired",
    icon: RiMailLine,
  },
  {
    key: "totalContractCount",
    label: "Total contracts",
    description: "Contracts involving this company",
    icon: RiFileList3Line,
  },
  {
    key: "activeContractCount",
    label: "Active contracts",
    description: "Contracts involving this company",
    icon: RiFileList3Line,
  },
  {
    key: "expiringContractCount",
    label: "Expiring soon",
    description: "Active contracts approaching their end date",
    icon: RiAlertLine,
  },
] as const;

export function CompanyDashboardView() {
  return (
    <CompanyAdminShell>
      {(access) => <DashboardContent companyId={access.company.id} />}
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
  } = useGetCompanyDashboardQuery({ companyId });
  const { data: user } = useGetCurrentUserQuery();
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Company Administrator";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <RiShieldUserLine className="size-3.5" />
              Company Administrator
            </Badge>
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome, {displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A current view of your company’s team and contract portfolio.
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
            className={`size-4 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div
          role="status"
          aria-label="Loading company dashboard"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
        >
          {summaryCards.map(({ key }) => (
            <Skeleton key={key} className="h-36 rounded-xl" />
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
          <section
            aria-label="Company summary"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
          >
            {summaryCards.map(({ key, label, description, icon: Icon }) => (
              <Card key={key}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardDescription className="font-medium">
                      {label}
                    </CardDescription>
                    <Avatar className="rounded-lg after:rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-5" aria-hidden="true" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="font-heading text-3xl font-semibold tabular-nums">
                    {data.summary[key].toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {key === "expiringContractCount"
                      ? `Active contracts ending within ${data.expiryWindowDays} days`
                      : description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section
            aria-label="Contract activity"
            className="grid gap-4 lg:grid-cols-2"
          >
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 className="text-lg">Contracts expiring soon</h2>
                </CardTitle>
                <CardDescription>
                  Active contracts ending in the next {data.expiryWindowDays}{" "}
                  days. Showing up to five, soonest first.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.expiringContracts.length ? (
                  <ul className="divide-y">
                    {data.expiringContracts.map((contract) => (
                      <li
                        key={contract.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <Link
                            href={contractHref(companyId, contract.id)}
                            className="font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {contract.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {contract.referenceNumber}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Badge variant="outline" className="capitalize">
                            {contract.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {daysUntil(contract.endDate)}
                          </span>
                          <time
                            className="text-xs text-muted-foreground"
                            dateTime={contract.endDate ?? undefined}
                          >
                            {formatDate(contract.endDate)}
                          </time>
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

            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 className="text-lg">Recently updated contracts</h2>
                </CardTitle>
                <CardDescription>
                  Contracts updated in the last 30 days, newest first.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.recentlyUpdatedContracts.length ? (
                  <ul className="divide-y">
                    {data.recentlyUpdatedContracts.map((contract) => (
                      <li
                        key={contract.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <Link
                            href={contractHref(companyId, contract.id)}
                            className="font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {contract.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {contract.referenceNumber}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Badge variant="outline" className="capitalize">
                            {contract.status}
                          </Badge>
                          <time
                            className="text-xs text-muted-foreground"
                            dateTime={contract.updatedAt}
                          >
                            Updated {formatTimestamp(contract.updatedAt)}
                          </time>
                          <span className="text-xs text-muted-foreground">
                            End date: {formatDate(contract.endDate)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-3 text-sm text-muted-foreground">
                    No contracts have been updated in the last 30 days.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2 className="text-lg">Quick actions</h2>
              </CardTitle>
              <CardDescription>
                Shortcuts to company and contract workflows.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link
                className={buttonVariants({ variant: "outline" })}
                href={`/dashboards/contracts?companyId=${encodeURIComponent(companyId)}`}
              >
                View contracts
              </Link>
              <Link
                className={buttonVariants({ variant: "outline" })}
                href={`/dashboards/team?companyId=${encodeURIComponent(companyId)}`}
              >
                Manage team and invitations
              </Link>
              <Link
                className={buttonVariants({ variant: "outline" })}
                href={`/dashboards/profile?companyId=${encodeURIComponent(companyId)}`}
              >
                Edit company profile
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2 className="text-lg">Activity and company documents</h2>
              </CardTitle>
              <CardDescription>
                Company-wide activity and document listings are not available in
                this dashboard yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No activity or document data is shown here because the current
                dashboard API does not provide these company-level lists.
              </p>
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 className="text-lg">Company profile</h2>
                </CardTitle>
                <CardDescription>
                  Company information currently registered with ContractFlow.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <ProfileField
                    label="Legal name"
                    value={data.company.legalName}
                  />
                  <ProfileField
                    label="Registration number"
                    value={data.company.registrationNumber}
                  />
                  <ProfileField
                    label="Contact email"
                    value={data.company.email}
                  />
                  <ProfileField
                    label="Phone"
                    value={data.company.phoneNumber}
                  />
                  <ProfileField
                    label="Location"
                    value={`${data.company.city}, ${data.company.countryCode}`}
                  />
                  <ProfileField
                    label="Default currency"
                    value={data.company.defaultCurrencyCode}
                  />
                </dl>
                <Link
                  className="mt-5 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
                  href={`/dashboards/profile?companyId=${encodeURIComponent(companyId)}`}
                >
                  Edit company profile
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 className="text-lg">Your access</h2>
                </CardTitle>
                <CardDescription>
                  Permissions are determined by your current company membership.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3 rounded-lg bg-muted/60 p-4">
                  <RiShieldUserLine className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      {data.membership.companyRole}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      You can administer this company workspace. Platform
                      administration is a separate role.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm">{value || "Not provided"}</dd>
    </div>
  );
}

function contractHref(companyId: string, contractId: string): string {
  return `/dashboards/contracts/${encodeURIComponent(contractId)}?companyId=${encodeURIComponent(companyId)}`;
}

function formatDate(value: string | null): string {
  if (!value) return "Date not available";
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function daysUntil(value: string | null): string {
  if (!value) return "End date unavailable";
  const expiry = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(expiry.getTime())) return "End date unavailable";
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const remaining = Math.max(
    0,
    Math.ceil((expiry.getTime() - today.getTime()) / 86400000),
  );
  return remaining === 0
    ? "Ends today"
    : `Ends in ${remaining} day${remaining === 1 ? "" : "s"}`;
}
