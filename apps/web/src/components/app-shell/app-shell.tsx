"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiMenuFoldLine,
  RiMenuUnfoldLine,
} from "@remixicon/react";
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
import { cn } from "@/lib/utils";
import {
  activeNavChild,
  activeNavModule,
  isNavItemActive,
  modulePages,
  type AppNavGroup,
  type AppNavItem,
} from "./navigation";

/**
 * The context page chosen from the module sidebar, kept across navigation:
 * each page mounts its own shell, so the link that had focus is replaced.
 */
let pendingPageFocus: string | null = null;

/**
 * The layout every signed-in area shares, in up to three columns:
 *
 * - The primary sidebar lists the area's modules. It shows in full on pages
 *   that stand alone (an overview), and folds into an icon rail while a
 *   module with pages of its own is open, which the user can expand again.
 * - The module sidebar lists the open module's pages beside the rail.
 * - The main content fills what's left.
 *
 * Which module and page are active always comes from the URL, so links,
 * refreshes and the browser's back and forward buttons agree with it. Below
 * md, the navigation is one drawer: modules first, then a module's pages.
 */
export function AppShell({
  navigationLabel,
  brand,
  sidebarTop,
  navigation,
  contextModule,
  sidebarFooter,
  header,
  contentKey,
  children,
}: {
  /** Names the <nav> and the mobile drawer, e.g. "Company dashboard". */
  navigationLabel: string;
  /**
   * The area's brand. In the icon rail only its mark should show: hide its
   * text visually with `group-data-[collapsible=icon]:sr-only`, keeping the
   * link's name.
   */
  brand: ReactNode;
  /** Extra content under the brand, such as a company switcher. */
  sidebarTop?: ReactNode;
  navigation: readonly AppNavGroup[];
  /**
   * The record open on this route, such as one contract. Its pages replace
   * the matched module's in the module sidebar.
   */
  contextModule?: AppNavItem | null;
  sidebarFooter?: ReactNode;
  /** The area's header content, shown beside the mobile menu button. */
  header: ReactNode;
  /** Remounts the main content when it changes, such as the active company. */
  contentKey?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const activeModule = contextModule ?? activeNavModule(pathname, navigation);
  // The user's choice to expand the rail, for the module it was made in.
  // Opening another module folds it again: the route decides the layout.
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const collapsed =
    activeModule !== null && expandedModule !== activeModule.href;
  // Hovering the rail opens it in full over the module sidebar, without
  // moving the page, until the pointer leaves.
  const [hovering, setHovering] = useState(false);
  const peeking = collapsed && hovering;

  return (
    <SidebarProvider
      open={!collapsed || peeking}
      onOpenChange={(open) =>
        setExpandedModule(open && activeModule ? activeModule.href : null)
      }
      data-peek={peeking ? "true" : undefined}
      // While peeking, the sidebar's space in the layout stays rail-sized,
      // so it overlays the module sidebar instead of pushing it aside.
      className="data-[peek=true]:**:data-[slot=sidebar-gap]:w-(--sidebar-width-icon) data-[peek=true]:**:data-[slot=sidebar-container]:shadow-xl"
    >
      <Sidebar
        collapsible="icon"
        mobileTitle={navigationLabel}
        mobileDescription={`Links to the pages in ${navigationLabel.toLowerCase()}.`}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <SidebarHeader className="gap-3 border-b border-sidebar-border p-4 pe-14 md:pe-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
          {brand}
          {sidebarTop ? (
            <div className="group-data-[collapsible=icon]:hidden">
              {sidebarTop}
            </div>
          ) : null}
        </SidebarHeader>
        <SidebarContent>
          <AppNavigation
            // Back to the current module's pages whenever the route moves
            // to another module.
            key={activeModule?.href ?? "none"}
            label={navigationLabel}
            groups={navigation}
            activeModule={activeModule}
          />
        </SidebarContent>
        {sidebarFooter || activeModule ? (
          <SidebarFooter className="gap-2 border-t border-sidebar-border p-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
            {sidebarFooter ? (
              <div className="group-data-[collapsible=icon]:hidden">
                {sidebarFooter}
              </div>
            ) : null}
            {activeModule ? (
              <RailToggle
                pinned={!collapsed}
                onToggle={() =>
                  setExpandedModule(collapsed ? activeModule.href : null)
                }
              />
            ) : null}
          </SidebarFooter>
        ) : null}
      </Sidebar>

      {activeModule ? (
        <ModuleSidebar
          // A new module's pages slide in afresh.
          key={activeModule.href}
          module={activeModule}
          pathname={pathname}
        />
      ) : null}

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

/**
 * Keeps the rail expanded (pinned), or folds it again. Separate from
 * hovering: a peek closes when the pointer leaves, a pinned rail stays open.
 */
function RailToggle({
  pinned,
  onToggle,
}: {
  pinned: boolean;
  onToggle: () => void;
}) {
  const { isMobile } = useSidebar();
  if (isMobile) return null;
  const Icon = pinned ? RiMenuFoldLine : RiMenuUnfoldLine;
  return (
    <SidebarMenu>
      <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
        <SidebarMenuButton
          aria-expanded={pinned}
          tooltip={pinned ? "Collapse navigation" : "Expand navigation"}
          onClick={onToggle}
          className={railButtonClass}
        >
          <Icon aria-hidden="true" />
          <span className={railLabelClass}>
            {pinned ? "Collapse navigation" : "Expand navigation"}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/** Rail sizing: 40px targets with 18px icons, centred in the 64px rail. */
const railButtonClass =
  "[&_svg]:size-[18px] group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!";

/**
 * A label in the icon rail: gone from view, so only the icon shows, but kept
 * for screen readers, so each icon-only link and button keeps its name.
 */
const railLabelClass = "group-data-[collapsible=icon]:sr-only";

function AppNavigation({
  label,
  groups,
  activeModule,
}: {
  label: string;
  groups: readonly AppNavGroup[];
  activeModule: AppNavItem | null;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  // In the mobile drawer, a module opens its pages in the same drawer. It
  // starts on the current module's pages; the drawer remounts each time it
  // opens, so it always starts from the current route.
  const [chosenModule, setMobileModule] = useState<AppNavItem | null>(
    activeModule,
  );
  // The open module's data can arrive after the drawer's first render.
  const mobileModule =
    chosenModule && chosenModule.href === activeModule?.href
      ? activeModule
      : chosenModule;
  const closeDrawer = () => {
    if (isMobile) setOpenMobile(false);
  };

  if (isMobile && mobileModule) {
    return (
      <nav aria-label={`${mobileModule.label} pages`}>
        <SidebarGroup>
          {mobileModule.back ? (
            <ModuleBackLink back={mobileModule.back} onNavigate={closeDrawer} />
          ) : (
            <button
              type="button"
              onClick={() => setMobileModule(null)}
              className={moduleBackClass}
            >
              <RiArrowLeftSLine className="size-4" aria-hidden="true" />
              All of {label.toLowerCase()}
            </button>
          )}
          <ModuleHeading module={mobileModule} />
          <SidebarGroupContent>
            <ModulePages
              module={mobileModule}
              pathname={pathname}
              onNavigate={closeDrawer}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      </nav>
    );
  }

  return (
    <nav aria-label={label}>
      {groups.map((group, index) => (
        <SidebarGroup key={group.label ?? index}>
          {group.label ? (
            // Removed outright in the rail, where only icons remain.
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
              {group.label}
            </SidebarGroupLabel>
          ) : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon;
                if (item.plannedNote) {
                  return (
                    <SidebarMenuItem
                      key={item.href}
                      className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
                    >
                      <SidebarMenuButton
                        disabled
                        title={item.plannedNote}
                        tooltip={`${item.label} (planned)`}
                        className={railButtonClass}
                      >
                        <Icon aria-hidden="true" />
                        <span className={railLabelClass}>{item.label}</span>
                      </SidebarMenuButton>
                      <SidebarMenuBadge>Planned</SidebarMenuBadge>
                    </SidebarMenuItem>
                  );
                }
                const active = isNavItemActive(pathname, item);
                if (isMobile && item.children?.length) {
                  // Opens the module's pages in the drawer; picking one
                  // navigates.
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        onClick={() => setMobileModule(item)}
                        className="border-s-2 border-transparent data-active:border-sidebar-primary"
                      >
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                        <RiArrowRightSLine
                          className="ms-auto"
                          aria-hidden="true"
                        />
                        <span className="sr-only">, show its pages</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
                return (
                  <SidebarMenuItem
                    key={item.href}
                    className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
                  >
                    <SidebarMenuButton
                      isActive={active}
                      // A module is "current" through its pages, which say
                      // so in the module sidebar; a standalone page says so
                      // here.
                      aria-current={
                        active
                          ? item.children?.length
                            ? "true"
                            : "page"
                          : undefined
                      }
                      tooltip={item.label}
                      className={cn(
                        "border-s-2 border-transparent data-active:border-sidebar-primary",
                        railButtonClass,
                      )}
                      onClick={closeDrawer}
                      render={<Link href={item.href} />}
                    >
                      <Icon aria-hidden="true" />
                      <span className={railLabelClass}>{item.label}</span>
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

/** The open module's pages, beside the rail from md. */
function ModuleSidebar({
  module,
  pathname,
}: {
  module: AppNavItem;
  pathname: string;
}) {
  // Below md the drawer holds the module's pages instead.
  const { isMobile } = useSidebar();
  if (isMobile) return null;
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground md:flex",
        // A context module stays put between its pages, which each mount a
        // new shell; only a module's first appearance slides in.
        !module.pageGroups &&
          "animate-in fade-in-0 slide-in-from-left-2 duration-200 motion-reduce:animate-none",
      )}
    >
      <nav
        aria-label={`${module.label} pages`}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3"
      >
        {module.back ? <ModuleBackLink back={module.back} /> : null}
        <ModuleHeading module={module} />
        <ModulePages module={module} pathname={pathname} />
      </nav>
    </aside>
  );
}

const moduleBackClass =
  "flex min-h-10 items-center gap-1 rounded-xl px-2 text-sm font-medium text-sidebar-foreground/80 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring";

function ModuleBackLink({
  back,
  onNavigate,
}: {
  back: NonNullable<AppNavItem["back"]>;
  onNavigate?: () => void;
}) {
  return (
    <Link href={back.href} onClick={onNavigate} className={moduleBackClass}>
      <RiArrowLeftSLine className="size-4" aria-hidden="true" />
      {back.label}
    </Link>
  );
}

function ModuleHeading({ module }: { module: AppNavItem }) {
  if (module.heading) {
    return <div className="px-2 pt-2 pb-3">{module.heading}</div>;
  }
  return (
    <div className="px-2 pt-2 pb-3">
      <p className="font-heading text-sm font-semibold text-sidebar-accent-foreground">
        {module.label}
      </p>
      {module.description ? (
        <p className="mt-0.5 text-xs leading-5 text-sidebar-foreground/70">
          {module.description}
        </p>
      ) : null}
    </div>
  );
}

function ModulePages({
  module,
  pathname,
  onNavigate,
}: {
  module: AppNavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const current = activeNavChild(pathname, modulePages(module));
  const currentLink = useRef<HTMLAnchorElement>(null);
  const currentHref = current?.href;

  useEffect(() => {
    if (!currentHref || pendingPageFocus !== currentHref) return;
    pendingPageFocus = null;
    currentLink.current?.focus({ preventScroll: true });
  }, [currentHref]);

  if (module.pageGroups) {
    return (
      <div className="flex flex-col gap-4">
        {module.pageGroups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h2 className="px-2.5 pb-1 text-xs font-medium text-sidebar-foreground/70">
              {group.label}
            </h2>
            <PageLinks
              pages={group.items}
              current={current}
              currentLink={currentLink}
              pathname={pathname}
              onNavigate={onNavigate}
              keepFocus={!onNavigate}
            />
          </section>
        ))}
      </div>
    );
  }
  return (
    <PageLinks
      pages={module.children ?? []}
      current={current}
      currentLink={currentLink}
      pathname={pathname}
      onNavigate={onNavigate}
    />
  );
}

function PageLinks({
  pages,
  current,
  currentLink,
  pathname,
  onNavigate,
  keepFocus = false,
}: {
  pages: readonly AppNavItem[];
  current: AppNavItem | null;
  currentLink: RefObject<HTMLAnchorElement | null>;
  pathname: string;
  onNavigate?: () => void;
  /** Return focus to this link's page once it has opened. */
  keepFocus?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {pages.map((page) => {
        const Icon = page.icon;
        const active = page === current;
        return (
          <li key={page.dialog ?? page.href}>
            <Link
              ref={active ? currentLink : undefined}
              // A dialog entry opens over the page already open.
              href={
                page.dialog ? `${pathname}?dialog=${page.dialog}` : page.href
              }
              aria-current={active ? "page" : undefined}
              aria-haspopup={page.dialog ? "dialog" : undefined}
              onClick={() => {
                if (keepFocus) pendingPageFocus = page.href;
                onNavigate?.();
              }}
              className={cn(
                "relative flex min-h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring motion-reduce:transition-none",
                active
                  ? // The main sidebar's active item: its accent fill and
                    // the primary edge.
                    "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:start-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "size-4 shrink-0",
                  active
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground/70",
                )}
              />
              <span className="truncate">{page.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
