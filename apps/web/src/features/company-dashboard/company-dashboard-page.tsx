"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiAlertLine,
  RiBuilding4Line,
  RiFileList3Line,
  RiGroupLine,
  RiLogoutBoxRLine,
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
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { FieldLabel } from "@workspace/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import {
  useGetCompaniesQuery,
  useGetCompanyDashboardQuery,
} from "@/features/companies";
import { useGetCurrentUserQuery, useLogoutMutation } from "@/services/authApi";

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
    key: "activeContractCount",
    label: "Active contracts",
    description: "Contracts involving this company",
    icon: RiFileList3Line,
  },
  {
    key: "expiringContractCount",
    label: "Expiring soon",
    description: "Active contracts ending in 30 days",
    icon: RiAlertLine,
  },
] as const;

export function CompanyDashboardPage({
  initialCompanyId,
}: {
  initialCompanyId: string;
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const {
    data: companies,
    error: companiesError,
    isLoading: companiesLoading,
    refetch: refetchCompanies,
  } = useGetCompaniesQuery();
  const { data: user } = useGetCurrentUserQuery();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const adminCompanies =
    companies?.filter(({ membership }) => membership.canManageCompany) ?? [];
  const selectedCompanyId = companyId || adminCompanies[0]?.company.id || "";

  const selectedAccess = companies?.find(
    ({ company }) => company.id === selectedCompanyId,
  );
  const hasUnrecognizedSelection =
    Boolean(initialCompanyId) && Boolean(companies) && !selectedAccess;
  const {
    currentData: data,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useGetCompanyDashboardQuery(
    { companyId: selectedCompanyId },
    { skip: !selectedAccess?.membership.canManageCompany },
  );

  const isForbidden = getApiErrorStatus(error) === 403;
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Company Administrator";

  async function signOut() {
    try {
      await logout().unwrap();
      router.replace("/login");
    } catch (error) {
      setLogoutError(
        getApiErrorMessage(error, "Unable to sign out. Please try again."),
      );
    }
  }

  if (companiesLoading) {
    return (
      <main className="grid min-h-[60vh] place-items-center p-6">
        <p role="status" className="text-sm text-muted-foreground">
          Loading your company workspace…
        </p>
      </main>
    );
  }

  if (companiesError) {
    return (
      <DashboardMessage
        title="Unable to load your companies"
        description={getApiErrorMessage(
          companiesError,
          "Please try again in a moment.",
        )}
        action={
          <Button onClick={() => void refetchCompanies()} variant="outline">
            Try again
          </Button>
        }
      />
    );
  }

  if (!companies?.length) {
    return (
      <DashboardMessage
        title="Finish setting up your company"
        description="Create a company or join one through an invitation before opening the company workspace."
        action={
          <Button onClick={() => router.push("/onboarding")}>
            Continue onboarding
          </Button>
        }
      />
    );
  }

  if (!initialCompanyId && !selectedCompanyId && !adminCompanies.length) {
    return (
      <DashboardMessage
        title="Company administrator access required"
        description="You are a member of a company, but none of your current memberships grants Company Administrator access."
      />
    );
  }

  if (hasUnrecognizedSelection) {
    return (
      <DashboardMessage
        title="Company workspace unavailable"
        description="Your account does not have access to the selected company."
      />
    );
  }

  if (selectedAccess && !selectedAccess.membership.canManageCompany) {
    return (
      <DashboardMessage
        title="Company administrator access required"
        description="Your current company role does not allow access to administrative dashboard data."
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <RiBuilding4Line className="size-5" />
          </div>
          <div>
            <p className="font-heading text-sm font-semibold">ContractFlow</p>
            <p className="text-xs text-muted-foreground">Company workspace</p>
          </div>
        </div>
        <nav aria-label="Company navigation" className="space-y-1 p-3">
          <Link
            href={`/dashboards?companyId=${encodeURIComponent(selectedCompanyId)}`}
            aria-current="page"
            className="flex items-center gap-3 rounded-md bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary"
          >
            <RiBuilding4Line className="size-4" />
            Overview
          </Link>
          <Link
            href={`/dashboards/team?companyId=${encodeURIComponent(selectedCompanyId)}`}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RiGroupLine className="size-4" />
            Team & invitations
          </Link>
          <Link
            href={`/dashboards/profile?companyId=${encodeURIComponent(selectedCompanyId)}`}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RiBuilding4Line className="size-4" />
            Company profile
          </Link>
        </nav>
        <div className="mt-auto border-t p-4 text-xs text-muted-foreground">
          Administrative access is limited to this company.
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b bg-card/90 px-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Company / Overview</p>
            <h1 className="truncate text-sm font-semibold">
              {data?.company.name ??
                selectedAccess?.company.name ??
                "Workspace"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {adminCompanies.length > 1 ? (
              <>
                <FieldLabel className="sr-only" htmlFor="company-switcher">
                  Select company
                </FieldLabel>
                <NativeSelect
                  id="company-switcher"
                  className="max-w-40 sm:max-w-56"
                  value={selectedCompanyId}
                  onChange={(event) => {
                    const nextCompanyId = event.target.value;
                    setCompanyId(nextCompanyId);
                    router.replace(
                      `/dashboards?companyId=${encodeURIComponent(nextCompanyId)}`,
                    );
                  }}
                >
                  {adminCompanies.map(({ company }) => (
                    <NativeSelectOption key={company.id} value={company.id}>
                      {company.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </>
            ) : null}
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={isLoggingOut}
              onClick={() => void signOut()}
            >
              <RiLogoutBoxRLine className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>
        <nav
          aria-label="Company navigation"
          className="flex gap-1 overflow-x-auto border-b bg-card px-4 py-2 md:hidden"
        >
          <Link
            href={`/dashboards?companyId=${encodeURIComponent(selectedCompanyId)}`}
            aria-current="page"
            className="shrink-0 rounded-md bg-primary/10 px-3 py-2 text-xs font-medium text-primary"
          >
            Overview
          </Link>
          <Link
            href={`/dashboards/team?companyId=${encodeURIComponent(selectedCompanyId)}`}
            className="shrink-0 rounded-md px-3 py-2 text-xs text-muted-foreground"
          >
            Team & invitations
          </Link>
          <Link
            href={`/dashboards/profile?companyId=${encodeURIComponent(selectedCompanyId)}`}
            className="shrink-0 rounded-md px-3 py-2 text-xs text-muted-foreground"
          >
            Company profile
          </Link>
        </nav>

        <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
          {logoutError && (
            <Alert variant="destructive">
              <AlertDescription>{logoutError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <RiShieldUserLine className="size-3.5" />
                  Company Administrator
                </Badge>
              </div>
              <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                Welcome, {displayName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A current view of your company’s team and contract portfolio.
              </p>
            </div>
            {data && (
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
            )}
          </div>

          {isLoading ? (
            <div
              role="status"
              aria-label="Loading company dashboard"
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
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
                <AlertTitle>
                  {isForbidden
                    ? "Company administrator access required"
                    : "Dashboard data could not be loaded"}
                </AlertTitle>
                <AlertDescription>
                  {isForbidden
                    ? "Your company membership may have changed. Refresh your access before continuing."
                    : getApiErrorMessage(error, "Please retry the request.")}
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
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
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
                        {description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </section>

              <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <h3 className="text-lg">Company profile</h3>
                    </CardTitle>
                    <CardDescription>
                      Company information currently registered with
                      ContractFlow.
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
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>
                      <h3 className="text-lg">Your access</h3>
                    </CardTitle>
                    <CardDescription>
                      Permissions are determined by your current company
                      membership.
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
        </main>
      </div>
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

function DashboardMessage({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <main className="grid min-h-[60vh] place-items-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl">{title}</h1>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {action && <CardFooter>{action}</CardFooter>}
      </Card>
    </main>
  );
}
