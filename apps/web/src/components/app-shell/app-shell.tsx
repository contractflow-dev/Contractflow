"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@workspace/ui/components/sidebar";
import { isNavItemActive, type AppNavGroup } from "./navigation";

/**
 * The layout every signed-in area shares: the shared Sidebar (a fixed column
 * from md, an accessible modal drawer below it), a sticky header and the main
 * content. Each area supplies its own navigation and header content.
 */
export function AppShell({
  navigationLabel,
  brand,
  sidebarTop,
  navigation,
  sidebarFooter,
  header,
  contentKey,
  children,
}: {
  /** Names the <nav> and the mobile drawer, e.g. "Company dashboard". */
  navigationLabel: string;
  brand: ReactNode;
  /** Extra content under the brand, such as a company switcher. */
  sidebarTop?: ReactNode;
  navigation: readonly AppNavGroup[];
  sidebarFooter?: ReactNode;
  /** The area's header content, shown beside the mobile menu button. */
  header: ReactNode;
  /** Remounts the main content when it changes, such as the active company. */
  contentKey?: string;
  children: ReactNode;
}) {
  return (
    // The desktop sidebar stays open: the areas have no collapsed layout.
    <SidebarProvider open onOpenChange={() => {}}>
      <Sidebar
        mobileTitle={navigationLabel}
        mobileDescription={`Links to the pages in ${navigationLabel.toLowerCase()}.`}
      >
        <SidebarHeader className="gap-3 border-b border-sidebar-border p-4 pe-14 md:pe-4">
          {brand}
          {sidebarTop}
        </SidebarHeader>
        <SidebarContent>
          <AppNavigation label={navigationLabel} groups={navigation} />
        </SidebarContent>
        {sidebarFooter ? (
          <SidebarFooter className="border-t border-sidebar-border p-3">
            {sidebarFooter}
          </SidebarFooter>
        ) : null}
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b bg-card/90 px-4 py-2 backdrop-blur sm:px-6">
          <MobileMenuButton label={navigationLabel} />
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
            {header}
          </div>
        </header>
        <main
          key={contentKey}
          className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8"
        >
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

function MobileMenuButton({ label }: { label: string }) {
  const { openMobile } = useSidebar();
  return (
    <SidebarTrigger
      size="icon"
      className="md:hidden"
      aria-label={`Open ${label.toLowerCase()} menu`}
      aria-expanded={openMobile}
      aria-haspopup="dialog"
    />
  );
}

function AppNavigation({
  label,
  groups,
}: {
  label: string;
  groups: readonly AppNavGroup[];
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <nav aria-label={label}>
      {groups.map((group, index) => (
        <SidebarGroup key={group.label ?? index}>
          {group.label ? (
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          ) : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon;
                if (item.plannedNote) {
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton disabled title={item.plannedNote}>
                        <Icon aria-hidden="true" />
                        {item.label}
                      </SidebarMenuButton>
                      <SidebarMenuBadge>Planned</SidebarMenuBadge>
                    </SidebarMenuItem>
                  );
                }
                const active = isNavItemActive(pathname, item);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      aria-current={active ? "page" : undefined}
                      className="border-s-2 border-transparent data-active:border-sidebar-primary"
                      // Choosing a page closes the mobile drawer.
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                      }}
                      render={<Link href={item.href} />}
                    >
                      <Icon aria-hidden="true" />
                      {item.label}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </nav>
  );
}
