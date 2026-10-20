"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useLogoutMutation } from "@/services/authApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setActiveWorkspaceId,
  selectActiveWorkspaceId,
} from "@/features/workspace/workspaceSlice";
import { getApiErrorMessage } from "@/lib/apiError";
import { useGetCompaniesQuery } from "./companiesApi";
import type { CompanyAccess } from "./companiesApi";

const linkClass =
  "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted";

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
        <p role="status" className="text-sm text-muted-foreground">
          Loading your companies…
        </p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <section className="max-w-lg space-y-3 rounded-xl border bg-card p-6">
          <h1 className="text-lg font-semibold">Unable to load companies</h1>
          <p role="alert" className="text-sm text-destructive">
            {getApiErrorMessage(error, "Please try again in a moment.")}
          </p>
        </section>
      </main>
    );
  }
  if (!companies?.length) {
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <section className="max-w-lg space-y-3 rounded-xl border bg-card p-6">
          <h1 className="text-lg font-semibold">No active company</h1>
          <p className="text-sm text-muted-foreground">
            Create a company or ask an administrator to invite you.
          </p>
          <Link className="text-sm font-medium text-primary underline" href="/onboarding">
            Continue to onboarding
          </Link>
        </section>
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

  return (
    <main className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href={`/dashboards${companyQuery}`} className="font-semibold">
              ContractFlow
            </Link>
            <label className="sr-only" htmlFor="company-switcher">
              Select company
            </label>
            <select
              id="company-switcher"
              aria-label="Select company"
              className="h-10 max-w-[min(60vw,22rem)] rounded-md border bg-background px-3 text-sm"
              value={access.company.id}
              onChange={(event) => {
                dispatch(setActiveWorkspaceId(event.target.value));
                router.replace(`${pathname}?companyId=${encodeURIComponent(event.target.value)}`);
              }}
            >
              {companies.map(({ company }) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="min-h-10 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-60"
            disabled={logoutState.isLoading}
            onClick={() => void signOut()}
          >
            {logoutState.isLoading ? "Signing out…" : "Sign out"}
          </button>
        </div>
        <nav
          aria-label="Company dashboard"
          className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 pb-3 sm:px-6"
        >
          <Link
            href={`/dashboards${companyQuery}`}
            aria-current={pathname === "/dashboards" ? "page" : undefined}
            className={linkClass}
          >
            Overview
          </Link>
          {adminLinks.map(({ href, label }) => (
            <Link
              key={href.split("?")[0]}
              href={href}
              aria-current={pathname === href.split("?")[0] ? "page" : undefined}
              className={linkClass}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {children(access)}
      </section>
    </main>
  );
}
