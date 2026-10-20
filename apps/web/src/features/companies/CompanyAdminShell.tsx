"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useLogoutMutation } from "@/services/authApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setActiveWorkspaceId,
  selectActiveWorkspaceId,
} from "@/features/workspace/workspaceSlice";
import { getApiErrorMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { useGetCompaniesQuery } from "./companiesApi";
import type { CompanyAccess } from "./companiesApi";

export function CompanyAdminShell({
  children,
}: {
  children: (access: CompanyAccess) => ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const selectedCompanyId = useAppSelector(selectActiveWorkspaceId);
  const { currentData: companies, error, isFetching } = useGetCompaniesQuery();
  const [logout, logoutState] = useLogoutMutation();
  const preferredCompanyId =
    searchParams.get("companyId") ?? selectedCompanyId;
  const access =
    companies?.find(({ company }) => company.id === preferredCompanyId) ??
    companies?.[0];
  const companyId = access?.company.id;

  useEffect(() => {
    if (companyId && companyId !== selectedCompanyId) {
      dispatch(setActiveWorkspaceId(companyId));
    }
  }, [companyId, dispatch, selectedCompanyId]);

  async function signOut() {
    try {
      await logout().unwrap();
      router.replace("/login");
    } catch (logoutError) {
      window.alert(getApiErrorMessage(logoutError, "Unable to sign out."));
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
      <main className="grid min-h-svh place-items-center p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle role="heading" aria-level={1} className="text-lg font-semibold">
              Unable to load companies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                {getApiErrorMessage(error, "Please try again in a moment.")}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </main>
    );
  }
  if (!companies?.length) {
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle role="heading" aria-level={1} className="text-lg font-semibold">
              No active company
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Create a company or ask an administrator to invite you.
            </p>
            <Link
              className={buttonVariants({ variant: "link" })}
              href="/onboarding"
            >
              Continue to onboarding
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }
  if (!access) return null;

  const companyQuery = `?companyId=${encodeURIComponent(access.company.id)}`;
  const adminLinks = access.membership.canManageCompany
    ? [
        { href: `/dashboards/team${companyQuery}`, label: "Team" },
        { href: `/dashboards/settings${companyQuery}`, label: "Company profile" },
      ]
    : [];
  const navLinkClass = (current: boolean) =>
    cn(
      buttonVariants({ variant: current ? "secondary" : "ghost" }),
      "h-9 px-3",
    );

  return (
    <main className="min-h-svh bg-muted/30">
      <header className="bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href={`/dashboards${companyQuery}`} className="font-semibold">
              ContractFlow
            </Link>
            <label className="sr-only" htmlFor="company-switcher">
              Select company
            </label>
            <NativeSelect
              id="company-switcher"
              aria-label="Select company"
              className="max-w-[min(60vw,22rem)]"
              value={access.company.id}
              onChange={(event) => {
                dispatch(setActiveWorkspaceId(event.target.value));
                router.replace(`${pathname}?companyId=${encodeURIComponent(event.target.value)}`);
              }}
            >
              {companies.map(({ company }) => (
                <NativeSelectOption key={company.id} value={company.id}>
                  {company.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={logoutState.isLoading}
            onClick={() => void signOut()}
          >
            {logoutState.isLoading ? "Signing out…" : "Sign out"}
          </Button>
        </div>
        <nav
          aria-label="Company dashboard"
          className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 pb-3 sm:px-6"
        >
          <Link
            href={`/dashboards${companyQuery}`}
            aria-current={pathname === "/dashboards" ? "page" : undefined}
            className={navLinkClass(pathname === "/dashboards")}
          >
            Overview
          </Link>
          {adminLinks.map(({ href, label }) => (
            <Link
              key={href.split("?")[0]}
              href={href}
              aria-current={pathname === href.split("?")[0] ? "page" : undefined}
              className={navLinkClass(pathname === href.split("?")[0])}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Separator />
      </header>
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {children(access)}
      </section>
    </main>
  );
}
