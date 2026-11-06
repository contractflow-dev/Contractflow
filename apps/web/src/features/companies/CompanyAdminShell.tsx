"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import {
  RiBuilding4Line,
  RiFileList3Line,
  RiGroupLine,
  RiSettings3Line,
  RiUserLine,
} from "@remixicon/react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SignOutAction } from "@/components/auth/sign-out-action";
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

const links = [
  {
    href: "/dashboards",
    label: "Overview",
    icon: RiBuilding4Line,
    adminOnly: true,
  },
  {
    href: "/dashboards/contracts",
    label: "Contracts",
    icon: RiFileList3Line,
    adminOnly: false,
  },
  {
    href: "/dashboards/team",
    label: "Team",
    icon: RiGroupLine,
    adminOnly: true,
  },
  {
    href: "/dashboards/profile",
    label: "Company profile",
    icon: RiSettings3Line,
    adminOnly: true,
  },
] as const;

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

function isActiveRoute(pathname: string, href: string): boolean {
  return (
    pathname === href ||
    (href !== "/dashboards" && pathname.startsWith(`${href}/`))
  );
}

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
  const needsAccessSummary = !!companies && !error && !availableCompanies.length;
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
  const isAdminRoute = links.some(
    ({ href, adminOnly }) => adminOnly && isActiveRoute(pathname, href),
  );

  const navigation = links.filter(
    ({ adminOnly }) => !adminOnly || access.membership.canManageCompany,
  );
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Account";
  const initials =
    `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase();
  const sidebarLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm font-medium",
      active
        ? "border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground"
        : "border-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
    );

  return (
    <div className="min-h-svh bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="space-y-3 border-b border-sidebar-border px-5 py-4">
          <Link href={homePath} className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <RiBuilding4Line className="size-5" />
            </span>
            <span className="font-heading text-lg font-semibold text-sidebar-accent-foreground">
              ContractFlow
            </span>
          </Link>
          {hasMultipleCompanies && (
            <CompanySwitcher
              companies={availableCompanies}
              value={access.company.id}
              onChange={selectCompany}
              className="w-full"
            />
          )}
        </div>
        <nav aria-label="Company dashboard" className="space-y-1 p-3">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = isActiveRoute(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={sidebarLinkClass(active)}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/60">
          Contract access is based on active company membership and contract
          participation.
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 border-b bg-card/90 px-4 py-2 backdrop-blur sm:px-6">
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Company workspace</p>
              <p
                className={cn(
                  "truncate text-sm font-semibold",
                  hasMultipleCompanies && "hidden md:block",
                )}
              >
                {access.company.name}
              </p>
              {/* The sidebar holding the desktop switcher is hidden below md. */}
              {hasMultipleCompanies && (
                <CompanySwitcher
                  companies={availableCompanies}
                  value={access.company.id}
                  onChange={selectCompany}
                  className="mt-1 w-full max-w-xs md:hidden [&_select]:h-10 [&_select]:font-semibold"
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger
                  type="button"
                  aria-label="Open account menu"
                  className="flex min-h-9 items-center gap-2 rounded-md border bg-background px-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials || <RiUserLine className="size-4" />}
                  </span>
                  <span className="hidden min-w-0 sm:block">
                    <span className="block max-w-36 truncate text-xs font-medium">
                      {displayName}
                    </span>
                    <span className="block max-w-36 truncate text-[11px] text-muted-foreground">
                      {user?.email ?? "Your account"}
                    </span>
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      <span className="block truncate font-medium">
                        {displayName}
                      </span>
                      {user?.email && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      )}
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <SignOutAction presentation="menu-item" />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <nav
            aria-label="Company dashboard"
            className="mt-2 flex gap-1 overflow-x-auto border-t pt-2 md:hidden"
          >
            {navigation.map(({ href, label, icon: Icon }) => {
              const active = isActiveRoute(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main
          key={access.company.id}
          className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8"
        >
          {isAdminRoute && !access.membership.canManageCompany ? (
            <Card className="max-w-lg">
              <CardHeader>
                <CardTitle>Company administrator access required</CardTitle>
                <CardDescription>
                  Your active membership does not grant access to company
                  overview or administration.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            children(access)
          )}
        </main>
      </div>
    </div>
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
