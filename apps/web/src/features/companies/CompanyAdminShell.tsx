"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
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
import { useGetCurrentUserQuery } from "@/services/authApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectActiveWorkspaceId,
  setActiveWorkspaceId,
} from "@/features/workspace/workspaceSlice";
import { getApiErrorMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { useGetCompaniesQuery } from "./companiesApi";
import type { CompanyAccess } from "./companiesApi";

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

function isActiveRoute(pathname: string, href: string): boolean {
  return (
    pathname === href ||
    (href !== "/dashboards" && pathname.startsWith(`${href}/`))
  );
}

export function CompanyAdminShell({
  children,
}: {
  children: (access: CompanyAccess) => ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const activeWorkspaceId = useAppSelector(selectActiveWorkspaceId);
  const { data: user } = useGetCurrentUserQuery();
  const {
    currentData: companies,
    error,
    isFetching,
    refetch,
  } = useGetCompaniesQuery();
  const requestedCompanyId = searchParams.get("companyId");
  const selectedId =
    requestedCompanyId ??
    companies?.find(({ company }) => company.id === activeWorkspaceId)?.company
      .id ??
    companies?.[0]?.company.id;
  const access = companies?.find(({ company }) => company.id === selectedId);
  const invalidRequestedCompany = Boolean(
    requestedCompanyId && companies && !access,
  );

  useEffect(() => {
    if (access && access.company.id !== activeWorkspaceId) {
      dispatch(setActiveWorkspaceId(access.company.id));
    }
  }, [access, activeWorkspaceId, dispatch]);

  function selectCompany(companyId: string) {
    dispatch(setActiveWorkspaceId(companyId));
    router.replace(`${pathname}?companyId=${encodeURIComponent(companyId)}`);
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

  if (!companies?.length) {
    return (
      <WorkspaceNotice
        title="No active company"
        description="Create a company or ask an administrator to invite you."
        action={
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href="/onboarding"
          >
            Continue to onboarding
          </Link>
        }
      />
    );
  }

  if (invalidRequestedCompany || !access) {
    return (
      <WorkspaceNotice
        title="Company workspace unavailable"
        description="Your account does not have access to the selected company. Choose one of your active memberships to continue."
        action={
          <NativeSelect
            aria-label="Select an active company"
            value=""
            onChange={(event) => selectCompany(event.target.value)}
          >
            <NativeSelectOption value="" disabled>
              Select a company
            </NativeSelectOption>
            {companies.map(({ company }) => (
              <NativeSelectOption key={company.id} value={company.id}>
                {company.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        }
      />
    );
  }

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
  const companyQuery = `?companyId=${encodeURIComponent(access.company.id)}`;
  const linkClass = (active: boolean) =>
    cn(
      "flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium",
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <div className="min-h-svh bg-muted/30">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-card md:flex">
        <Link
          href={`/dashboards${companyQuery}`}
          className="flex h-16 items-center gap-3 border-b px-5"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <RiBuilding4Line className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-heading text-sm font-semibold">
              ContractFlow
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {access.company.name}
            </span>
          </span>
        </Link>
        <nav aria-label="Company dashboard" className="space-y-1 p-3">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = isActiveRoute(pathname, href);
            return (
              <Link
                key={href}
                href={`${href}${companyQuery}`}
                aria-current={active ? "page" : undefined}
                className={linkClass(active)}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t p-4 text-xs text-muted-foreground">
          Contract access is based on active company membership and contract
          participation.
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 border-b bg-card/90 px-4 py-2 backdrop-blur sm:px-6">
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Company workspace</p>
              <p className="truncate text-sm font-semibold">
                {access.company.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {companies.length > 1 && (
                <NativeSelect
                  aria-label="Select company"
                  className="max-w-40 sm:max-w-56"
                  value={access.company.id}
                  onChange={(event) => selectCompany(event.target.value)}
                >
                  {companies.map(({ company }) => (
                    <NativeSelectOption key={company.id} value={company.id}>
                      {company.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
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
                  href={`${href}${companyQuery}`}
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
