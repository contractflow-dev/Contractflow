"use client";

import React from "react";
import {
  RiMenuLine,
  RiShieldCheckLine,
  RiUserLine,
} from "@remixicon/react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Separator } from "@workspace/ui/components/separator";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SignOutAction } from "@/components/auth/sign-out-action";
import { useGetCurrentUserQuery } from "@/services/authApi";

interface AdminHeaderProps {
  onToggleMobileNav: () => void;
}

export function AdminHeader({ onToggleMobileNav }: AdminHeaderProps) {
  const { data: user } = useGetCurrentUserQuery();

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Platform Administrator";

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b bg-card/80 px-4 backdrop-blur-md sm:px-6">
      {/* Left: Mobile hamburger & breadcrumbs */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleMobileNav}
          className="md:hidden text-muted-foreground"
          aria-label="Open navigation menu"
        >
          <RiMenuLine className="size-5" />
        </Button>

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

        <div className="hidden lg:flex items-center gap-2 h-8">
          <Separator orientation="vertical" className="mr-1 bg-border/60" />
          <Avatar>
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {user?.firstName?.[0] ?? <RiUserLine className="size-4" />}
            </AvatarFallback>
          </Avatar>
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

        <SignOutAction />
      </div>
    </header>
  );
}
