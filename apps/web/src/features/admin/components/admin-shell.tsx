"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { RiExternalLinkLine, RiShieldUserLine } from "@remixicon/react";
import { AppShell } from "@/components/app-shell/app-shell";
import { ADMIN_NAVIGATION } from "../admin-navigation";
import { AdminHeader } from "./admin-header";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      navigationLabel="Platform admin navigation"
      brand={
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-bold tracking-tight text-brand-foreground shadow-sm">
            CF
          </span>
          <span className="flex flex-col">
            <span className="font-heading text-sm leading-none font-bold tracking-tight text-sidebar-accent-foreground">
              ContractFlow
            </span>
            <span className="mt-0.5 font-mono text-xs tracking-wider text-sidebar-foreground/70 uppercase">
              Platform Admin
            </span>
          </span>
        </Link>
      }
      navigation={ADMIN_NAVIGATION}
      sidebarFooter={
        <Link
          href="/dashboards"
          className="flex min-h-10 items-center justify-between rounded-xl px-3 text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring focus-visible:outline-hidden"
        >
          <span className="flex items-center gap-2">
            <RiShieldUserLine className="size-4" aria-hidden="true" />
            Company Workspace
          </span>
          <RiExternalLinkLine className="size-3.5" aria-hidden="true" />
        </Link>
      }
      header={<AdminHeader />}
    >
      {children}
    </AppShell>
  );
}
