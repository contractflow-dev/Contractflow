"use client";

import React from "react";
import { RiShieldCheckLine } from "@remixicon/react";
import { Badge } from "@workspace/ui/components/badge";
import { AccountMenu } from "@/components/account-menu/account-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/** The platform admin header content, placed in the AppShell header. */
export function AdminHeader() {
  return (
    <>
      {/* Left: breadcrumbs (the menu button comes from the AppShell) */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="font-semibold text-foreground">Platform Admin</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">Overview</span>
        </div>
      </div>

      {/* Right: role badge, theme toggle and the shared account menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Badge
          variant="outline"
          className="hidden sm:inline-flex items-center gap-1.5 border-brand/30 bg-brand/5 px-2.5 py-1 text-xs font-medium text-brand"
        >
          <RiShieldCheckLine className="size-3.5" />
          <span>Platform Administrator</span>
        </Badge>

        <ThemeToggle />

        <AccountMenu area="admin" />
      </div>
    </>
  );
}
