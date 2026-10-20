"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  RiMenuLine,
  RiLogoutBoxRLine,
  RiShieldCheckLine,
  RiUserLine,
} from "@remixicon/react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useGetCurrentUserQuery, useLogoutMutation } from "@/services/authApi";

interface AdminHeaderProps {
  onToggleMobileNav: () => void;
}

export function AdminHeader({ onToggleMobileNav }: AdminHeaderProps) {
  const router = useRouter();
  const { data: user } = useGetCurrentUserQuery();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // Ignored: clear session locally regardless
    } finally {
      router.replace("/login");
    }
  };

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Platform Administrator";

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b bg-card/80 px-4 backdrop-blur-md sm:px-6">
      {/* Left: Mobile hamburger & breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileNav}
          className="md:hidden rounded-lg p-2 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open navigation menu"
        >
          <RiMenuLine className="size-5" />
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="font-semibold text-foreground">Platform Admin</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">Overview</span>
        </div>
      </div>

      {/* Right: Security Badge, Profile, Theme Toggle, Sign Out */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Badge
          variant="outline"
          className="hidden sm:inline-flex items-center gap-1.5 border-brand/30 bg-brand/5 px-2.5 py-1 text-xs font-medium text-brand"
        >
          <RiShieldCheckLine className="size-3.5" />
          <span>Platform Administrator</span>
        </Badge>

        <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-border/60">
          <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
            {user?.firstName?.[0] ?? <RiUserLine className="size-4" />}
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-semibold leading-none text-foreground">
              {displayName}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 max-w-[140px] truncate">
              {user?.email}
            </span>
          </div>
        </div>

        <ThemeToggle />

        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30"
          title="Sign out of ContractFlow"
        >
          <RiLogoutBoxRLine className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
