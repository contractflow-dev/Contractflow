"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  RiDashboardLine,
  RiBuilding4Line,
  RiGroupLine,
  RiShieldKeyholeLine,
  RiLayoutMasonryLine,
  RiFileList3Line,
  RiShieldCheckLine,
  RiFolderLine,
  RiBankCardLine,
  RiMailSendLine,
  RiHistoryLine,
  RiBarChartBoxLine,
  RiSettings4Line,
  RiCloseLine,
  RiShieldUserLine,
  RiExternalLinkLine,
} from "@remixicon/react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isReady?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAVIGATION_GROUPS: NavGroup[] = [
  {
    label: "Core Control Plane",
    items: [
      {
        name: "Overview",
        href: "/admin",
        icon: RiDashboardLine,
        isReady: true,
      },
    ],
  },
  {
    label: "Tenancy & Access",
    items: [
      {
        name: "Companies",
        href: "/admin/companies",
        icon: RiBuilding4Line,
        isReady: false,
      },
      {
        name: "Users",
        href: "/admin/users",
        icon: RiGroupLine,
        isReady: false,
      },
      {
        name: "Roles & Permissions",
        href: "/admin/roles",
        icon: RiShieldKeyholeLine,
        isReady: false,
      },
      {
        name: "Workspaces",
        href: "/admin/workspaces",
        icon: RiLayoutMasonryLine,
        isReady: false,
      },
      {
        name: "Invitations",
        href: "/admin/invitations",
        icon: RiMailSendLine,
        isReady: false,
      },
    ],
  },
  {
    label: "Operations & Governance",
    items: [
      {
        name: "Contracts",
        href: "/admin/contracts",
        icon: RiFileList3Line,
        isReady: false,
      },
      {
        name: "Compliance & HSE",
        href: "/admin/compliance",
        icon: RiShieldCheckLine,
        isReady: false,
      },
      {
        name: "Documents",
        href: "/admin/documents",
        icon: RiFolderLine,
        isReady: false,
      },
      {
        name: "Payments",
        href: "/admin/payments",
        icon: RiBankCardLine,
        isReady: false,
      },
    ],
  },
  {
    label: "Audit & Configuration",
    items: [
      {
        name: "Activity Logs",
        href: "/admin/activity",
        icon: RiHistoryLine,
        isReady: false,
      },
      {
        name: "Reports",
        href: "/admin/reports",
        icon: RiBarChartBoxLine,
        isReady: false,
      },
      {
        name: "Settings",
        href: "/admin/settings",
        icon: RiSettings4Line,
        isReady: false,
      },
    ],
  },
];

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between">
      {/* Brand & Header */}
      <div>
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-brand text-brand-foreground font-bold text-sm tracking-tight shadow-sm">
              CF
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-sm font-bold tracking-tight text-foreground leading-none">
                ContractFlow
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
                Platform Admin
              </span>
            </div>
          </Link>

          {/* Close button for mobile drawer */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="md:hidden text-muted-foreground"
            aria-label="Close menu"
          >
            <RiCloseLine className="size-5" />
          </Button>
        </div>
        <Separator />

        {/* Navigation list */}
        <nav className="space-y-6 px-3 py-4 overflow-y-auto max-h-[calc(100vh-8rem)]">
          {NAVIGATION_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <h3 className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {group.label}
              </h3>
              <div className="space-y-0.5 pt-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  if (item.isReady) {
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="size-4 shrink-0" />
                          <span>{item.name}</span>
                        </div>
                        {isActive && (
                          <span className="size-1.5 rounded-full bg-emerald-400" />
                        )}
                      </Link>
                    );
                  }

                  // Non-ready items displayed as clearly planned
                  return (
                    <div
                      key={item.name}
                      className="group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-normal text-muted-foreground/60 cursor-not-allowed select-none"
                      title={`${item.name} module is planned for an upcoming milestone`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="size-4 shrink-0 opacity-60" />
                        <span>{item.name}</span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1.5 py-0 font-normal uppercase tracking-wider text-muted-foreground/80 bg-muted/60"
                      >
                        Planned
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer / Tenant return link */}
      <div className="bg-muted/20">
        <Separator />
        <div className="p-3">
        <Link
          href="/dashboards"
          className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <div className="flex items-center gap-2">
            <RiShieldUserLine className="size-4 text-brand" />
            <span>Company Workspace</span>
          </div>
          <RiExternalLinkLine className="size-3.5 text-muted-foreground" />
        </Link>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30 border-r bg-card shadow-sm">
        {sidebarContent}
      </aside>

      {/* Mobile drawer backdrop and sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-card border-r shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
