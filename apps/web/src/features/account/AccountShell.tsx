"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@workspace/ui/components/logo";
import { AccountMenu } from "@/components/account-menu/account-menu";
import { AppShell } from "@/components/app-shell/app-shell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useGetCurrentUserQuery } from "@/services/authApi";
import { ACCOUNT_NAVIGATION } from "./account-navigation";

/**
 * The personal account area: the signed-in user's own settings, in the
 * shared shell but without a company. It needs no company membership, so it
 * stays the same when the user switches company, or has none.
 */
export function AccountShell({ children }: { children: ReactNode }) {
  const { data: user } = useGetCurrentUserQuery();
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : "";

  return (
    <AppShell
      navigationLabel="My account"
      brand={
        <Link href="/dashboards" className="flex items-center gap-3">
          <LogoMark variant="inverse" className="size-9" />
          {/* In the icon rail only the mark shows; the name stays for
              screen readers. */}
          <span className="font-heading text-lg font-semibold text-sidebar-accent-foreground group-data-[collapsible=icon]:sr-only">
            ContractFlow
          </span>
        </Link>
      }
      sidebarTop={
        <div className="min-w-0 rounded-lg border border-sidebar-border px-3 py-3">
          <p className="text-xs text-muted-foreground">Personal account</p>
          <p className="truncate text-sm font-semibold">
            {name || user?.email || "Your account"}
          </p>
        </div>
      }
      navigation={ACCOUNT_NAVIGATION}
      header={
        <>
          <div className="min-w-0 flex-1" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AccountMenu area="account" />
          </div>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
