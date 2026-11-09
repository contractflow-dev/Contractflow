"use client";

import Link from "next/link";
import {
  RiBuilding4Line,
  RiShieldUserLine,
  RiUserLine,
} from "@remixicon/react";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { SignOutAction } from "@/components/auth/sign-out-action";
import { useGetCurrentUserQuery } from "@/services/authApi";

/** The signed-in area the menu is shown in, which decides the area link. */
export type AccountMenuArea = "company" | "admin";

/**
 * The account menu in the AppShell header: who is signed in, a link between
 * the company workspace and platform administration where the user can use
 * both, and sign out.
 *
 * It reads the user from the existing current-user query. Showing the
 * administration link is a convenience only: the admin layout and the API's
 * PlatformAdminGuard still decide access.
 */
export function AccountMenu({ area }: { area: AccountMenuArea }) {
  const { data: user } = useGetCurrentUserQuery();
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : "";
  const displayName = name || user?.email || "Your account";
  const initials =
    `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase();

  const areaLink =
    area === "admin"
      ? {
          href: "/dashboards",
          label: "Company workspace",
          icon: RiBuilding4Line,
        }
      : user?.isPlatformAdmin
        ? {
            href: "/admin",
            label: "Platform administration",
            icon: RiShieldUserLine,
          }
        : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label="Open account menu"
        className="flex min-h-10 items-center gap-2 rounded-2xl border bg-background px-2 text-start hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none data-popup-open:bg-muted"
      >
        <Avatar size="sm" className="after:border-transparent">
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials || <RiUserLine className="size-4" aria-hidden="true" />}
          </AvatarFallback>
        </Avatar>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-36 truncate text-xs font-medium">
            {displayName}
          </span>
          {/* <span className="block max-w-36 truncate text-xs text-muted-foreground">
            {user?.email ?? "Your account"}
          </span> */}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-auto min-w-60 max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 py-2">
            <Avatar>
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {initials || (
                  <RiUserLine className="size-4" aria-hidden="true" />
                )}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {displayName}
              </span>
              {user?.email && name ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              ) : null}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {areaLink ? (
          <>
            <DropdownMenuLinkItem render={<Link href={areaLink.href} />}>
              <areaLink.icon aria-hidden="true" />
              {areaLink.label}
            </DropdownMenuLinkItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <SignOutAction presentation="menu-item" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
