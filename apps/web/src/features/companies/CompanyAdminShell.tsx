"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import { RiBuilding3Fill, RiBuilding4Line } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { AppShell } from "@/components/app-shell/app-shell";
import { isNavItemActive } from "@/components/app-shell/navigation";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AccountMenu } from "@/components/account-menu/account-menu";
import { api } from "@/services/api";
import { useGetCurrentUserQuery } from "@/services/authApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearActiveWorkspace,
  selectActiveWorkspaceId,
  setActiveWorkspaceId,
} from "@/features/workspace/workspaceSlice";
import {
  clearPersistedActiveCompanyId,
  companyAccessState,
  companyLandingPath,
  persistActiveCompanyId,
  readPersistedActiveCompanyId,
  resolveActiveCompanyId,
  resolveWorkspaceRedirect,
  type CompanyAccessState,
} from "@/features/workspace";
import { getApiErrorMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import {
  useGetCompaniesQuery,
  useGetCompanyAccessSummaryQuery,
} from "@/services/companiesApi";
import type { ICompanyAccessResponse } from "@contractflow/contracts-schema";
import { COMPANY_NAVIGATION } from "./company-navigation";

const noCompanyNotices: Partial<
  Record<
    CompanyAccessState,
    { title: string; description: string; setupLabel: string }
  >
> = {
  new: {
    title: "Set up your company",
    description:
      "You aren't a member of a company yet. Taking you to company setup…",
    setupLabel: "Continue to company setup",
  },
  ended: {
    title: "Your company access has ended",
    description:
      "You're no longer a member of the company you used before. If you think this is a mistake, ask its administrator to invite you again.",
    setupLabel: "Create a new company instead",
  },
  "company-inactive": {
    title: "Your company's workspace is inactive",
    description:
      "The company you belong to has been deactivated, so its workspace isn't available. Contact your company administrator or ContractFlow support.",
    setupLabel: "Create a new company instead",
  },
};

export function CompanyAdminShell({
  children,
}: {
  children: (access: ICompanyAccessResponse) => ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const activeWorkspaceId = useAppSelector(selectActiveWorkspaceId);
  const search = searchParams.toString();
  const { data: user } = useGetCurrentUserQuery();
  const {
    currentData: companies,
    error,
    isFetching,
    refetch,
  } = useGetCompaniesQuery();
  const availableCompanies = useMemo(
    () =>
      (companies ?? []).filter(
        ({ company, membership }) =>
          company.status === "active" &&
          membership.status === "active" &&
          membership.companyId === company.id,
      ),
    [companies],
  );
  const availableCompanyIds = useMemo(
    () => availableCompanies.map(({ company }) => company.id),
    [availableCompanies],
  );
  const selectedId =
    activeWorkspaceId && availableCompanyIds.includes(activeWorkspaceId)
      ? activeWorkspaceId
      : availableCompanyIds[0];
  const access = availableCompanies.find(
    ({ company }) => company.id === selectedId,
  );
  // Only asked for when the user has no usable company, to tell a new user
  // from one whose access ended.
  const needsAccessSummary =
    !!companies && !error && !availableCompanies.length;
  const accessSummary = useGetCompanyAccessSummaryQuery(undefined, {
    skip: !needsAccessSummary,
  });
  const accessState = companyAccessState(
    availableCompanies.length > 0,
    accessSummary.currentData,
  );
  const redirectPath =
    companies && !error
      ? resolveWorkspaceRedirect({
          pathname,
          access: accessState,
          canManageCompany:
            access && activeWorkspaceId === access.company.id
              ? access.membership.canManageCompany
              : null,
        })
      : null;

  useEffect(() => {
    if (redirectPath) router.replace(redirectPath);
  }, [redirectPath, router]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (!params.has("companyId")) return;
    params.delete("companyId");
    const remainingQuery = params.toString();
    router.replace(
      remainingQuery ? `${pathname}?${remainingQuery}` : pathname,
      { scroll: false },
    );
  }, [pathname, router, search]);

  useEffect(() => {
    if (!companies || !user?.id) return;

    let persistedCompanyId: string | null = null;
    try {
      persistedCompanyId = readPersistedActiveCompanyId(
        window.localStorage,
        user.id,
      );
    } catch (error) {
      console.warn("Unable to restore the saved company selection.", error);
    }

    const companyId = resolveActiveCompanyId(
      availableCompanyIds,
      activeWorkspaceId,
      persistedCompanyId,
    );
    if (companyId) {
      if (companyId !== activeWorkspaceId) {
        dispatch(setActiveWorkspaceId(companyId));
      }
      try {
        persistActiveCompanyId(window.localStorage, user.id, companyId);
      } catch (error) {
        console.warn("Unable to persist the active company selection.", error);
      }
    } else {
      if (activeWorkspaceId) dispatch(clearActiveWorkspace());
      try {
        clearPersistedActiveCompanyId(window.localStorage, user.id);
      } catch (error) {
        console.warn("Unable to clear the saved company selection.", error);
      }
    }
  }, [activeWorkspaceId, availableCompanyIds, companies, dispatch, user?.id]);

  function selectCompany(companyId: string) {
    if (!availableCompanyIds.includes(companyId)) return;
    dispatch(setActiveWorkspaceId(companyId));
    dispatch(
      api.util.invalidateTags([
        { type: "Company", id: companyId },
        { type: "CompanyMember", id: companyId },
        { type: "CompanyInvitation", id: companyId },
        { type: "Dashboard", id: companyId },
      ]),
    );
    if (user?.id) {
      try {
        persistActiveCompanyId(window.localStorage, user.id, companyId);
      } catch (error) {
        console.warn("Unable to persist the active company selection.", error);
      }
    }
  }

  if (isFetching && !companies) {
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <div role="status" className="flex flex-col items-center gap-3">
          <Skeleton className="h-4 w-48" />
          <p className="text-sm text-muted-foreground">
            Loading your companies…
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <WorkspaceNotice
        title="Unable to load companies"
        description={getApiErrorMessage(error, "Please try again in a moment.")}
        action={
          <Button variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  if (!availableCompanies.length) {
    if (accessSummary.error) {
      return (
        <WorkspaceNotice
          title="Unable to check your company access"
          description={getApiErrorMessage(
            accessSummary.error,
            "Please try again in a moment.",
          )}
          action={
            <Button
              variant="outline"
              onClick={() => void accessSummary.refetch()}
            >
              Retry
            </Button>
          }
        />
      );
    }
    const notice = noCompanyNotices[accessState];
    if (!notice) {
      return (
        <main className="grid min-h-svh place-items-center p-6">
          <p role="status" className="text-sm text-muted-foreground">
            Checking your company access…
          </p>
        </main>
      );
    }
    return (
      <WorkspaceNotice
        title={notice.title}
        description={notice.description}
        action={
          <Link
            className="text-brand underline-offset-4 hover:underline"
            href="/onboarding"
          >
            {notice.setupLabel}
          </Link>
        }
      />
    );
  }

  if (!access || activeWorkspaceId !== access.company.id) {
    return (
      <WorkspaceNotice
        title="Loading your company workspace"
        description="Verifying your active company membership."
        action={
          availableCompanies.length > 1 ? (
            <NativeSelect
              aria-label="Select an active company"
              value={activeWorkspaceId ?? ""}
              onChange={(event) => selectCompany(event.target.value)}
            >
              <NativeSelectOption value="" disabled>
                Select a company
              </NativeSelectOption>
              {availableCompanies.map(({ company }) => (
                <NativeSelectOption key={company.id} value={company.id}>
                  {company.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : undefined
        }
      />
    );
  }

  if (redirectPath) {
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <p role="status" className="text-sm text-muted-foreground">
          Opening your workspace…
        </p>
      </main>
    );
  }

  const homePath = companyLandingPath(access.membership.canManageCompany);
  const hasMultipleCompanies = availableCompanies.length > 1;
  const isAdminRoute = COMPANY_NAVIGATION.some(
    (item) => item.adminOnly && isNavItemActive(pathname, item),
  );

  const navigation = COMPANY_NAVIGATION.filter(
    ({ adminOnly }) => !adminOnly || access.membership.canManageCompany,
  );
  return (
    <AppShell
      navigationLabel="Company dashboard"
      brand={
        <Link href={homePath} className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <RiBuilding4Line className="size-5" aria-hidden="true" />
          </span>
          <span className="font-heading text-lg font-semibold text-sidebar-accent-foreground">
            ContractFlow
          </span>
        </Link>
      }
      sidebarTop={
        hasMultipleCompanies ? (
          <CompanySwitcher
            companies={availableCompanies}
            value={access.company.id}
            onChange={selectCompany}
            className="w-full"
          />
        ) : (
          <div className="flex min-w-0 items-center gap-3 rounded-lg border border-sidebar-border px-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <RiBuilding3Fill className="size-5" aria-hidden="true" />
            </span>

            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Company workspace</p>
              <p className="truncate text-sm font-semibold">
                {access.company.name}
              </p>
            </div>
          </div>
        )
      }
      navigation={[{ items: navigation }]}
      sidebarFooter={
        <p className="px-1 text-xs text-sidebar-foreground/70">
          Contract access is based on active company membership and contract
          participation.
        </p>
      }
      header={
        <>
          <div className="min-w-0 flex-1">
            {/* <p className="text-xs text-muted-foreground">Company workspace</p> */}
            {/* <p
              className={cn(
                "truncate text-sm font-semibold",
                hasMultipleCompanies && "hidden md:block",
              )}
            >
              {access.company.name}
            </p> */}
            {/* The sidebar holding the desktop switcher is a drawer below md. */}
            {hasMultipleCompanies && (
              <CompanySwitcher
                companies={availableCompanies}
                value={access.company.id}
                onChange={selectCompany}
                className="mt-1 w-full max-w-xs md:hidden [&_select]:font-semibold"
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AccountMenu area="company" />
          </div>
        </>
      }
      contentKey={access.company.id}
    >
      {isAdminRoute && !access.membership.canManageCompany ? (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Company administrator access required</CardTitle>
            <CardDescription>
              Your active membership does not grant access to company overview
              or administration.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        children(access)
      )}
    </AppShell>
  );
}

function CompanySwitcher({
  companies,
  value,
  onChange,
  className,
}: {
  companies: readonly ICompanyAccessResponse[];
  value: string;
  onChange: (companyId: string) => void;
  className?: string;
}) {
  return (
    <NativeSelect
      aria-label="Select company"
      className={className}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {companies.map(({ company }) => (
        <NativeSelectOption key={company.id} value={company.id}>
          {company.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

function WorkspaceNotice({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <main className="grid min-h-svh place-items-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {action && (
          <CardFooter>
            <CardContent className="w-full p-0">{action}</CardContent>
          </CardFooter>
        )}
      </Card>
    </main>
  );
}
