import type { ComponentType, ReactNode } from "react";

/** One destination in an application area's sidebar. */
export interface AppNavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /**
   * `exact` matches only the href itself; `section` (the default) also
   * matches pages below it, so a contract's detail page keeps "Contracts"
   * active.
   */
  match?: "exact" | "section";
  /**
   * A module that is planned but not built. It is listed, disabled, with this
   * note as its description, and never links anywhere.
   */
  plannedNote?: string;
  /**
   * The module's own pages, shown in the secondary sidebar while one of them
   * is open. `href` is then the module's landing page, normally its first
   * page. Only real, built routes belong here.
   */
  children?: readonly AppNavItem[];
  /** A line under the module's name in the secondary sidebar. */
  description?: string;
  /**
   * A module entry that opens a dialog on the page already open instead of
   * going to a page of its own: it links to that page with `?dialog=<name>`,
   * and the page opens the dialog from the URL. It is never the active page.
   */
  dialog?: string;
  /** Other exact paths that belong to this page, such as its edit form. */
  alsoActiveOn?: readonly string[];
  /**
   * The module's pages under headings, in place of a flat `children` list.
   * Used by a context module, such as one contract's navigation.
   */
  pageGroups?: readonly AppNavGroup[];
  /** A link out of the module, shown above its heading. */
  back?: { href: string; label: string };
  /** Replaces the module's name in its sidebar, such as a contract's identity. */
  heading?: ReactNode;
}

export interface AppNavGroup {
  /** Shown above the group; omit for a single unlabelled list. */
  label?: string;
  items: readonly AppNavItem[];
}

/** Every page of a module, whether listed flat or under headings. */
export function modulePages(module: AppNavItem): readonly AppNavItem[] {
  return module.pageGroups
    ? module.pageGroups.flatMap(({ items }) => items)
    : (module.children ?? []);
}

/** Whether the path is the item's own page or, for `section`, below it. */
function matchesHref(pathname: string, item: AppNavItem): boolean {
  if (item.plannedNote || item.dialog) return false;
  if (pathname === item.href || item.alsoActiveOn?.includes(pathname)) {
    return true;
  }
  return item.match !== "exact" && pathname.startsWith(`${item.href}/`);
}

/**
 * The page of a module the path belongs to. When several match, as
 * `/dashboards/contracts` and `/dashboards/contracts/new` both do for the new
 * contract page, the most specific one wins, so only one is ever active.
 */
export function activeNavChild(
  pathname: string,
  children: readonly AppNavItem[],
): AppNavItem | null {
  let best: AppNavItem | null = null;
  for (const child of children) {
    if (
      matchesHref(pathname, child) &&
      (!best || child.href.length > best.href.length)
    ) {
      best = child;
    }
  }
  return best;
}

/** Whether the path is this item's page, or one of its module's pages. */
export function isNavItemActive(pathname: string, item: AppNavItem): boolean {
  if (item.plannedNote) return false;
  if (item.children?.length) {
    return (
      activeNavChild(pathname, item.children) !== null ||
      matchesHref(pathname, item)
    );
  }
  return matchesHref(pathname, item);
}

/**
 * The module whose secondary sidebar belongs to this path: the first item
 * with pages of its own that the path is in. Null on pages that stand alone,
 * such as the overview, so the primary sidebar shows in full there.
 */
export function activeNavModule(
  pathname: string,
  groups: readonly AppNavGroup[],
): AppNavItem | null {
  for (const group of groups) {
    for (const item of group.items) {
      if (item.children?.length && isNavItemActive(pathname, item)) {
        return item;
      }
    }
  }
  return null;
}

/** Every destination, modules' pages included, for route-wide checks. */
export function flattenNavItems(
  items: readonly AppNavItem[],
): readonly AppNavItem[] {
  return items.flatMap((item) => [item, ...(item.children ?? [])]);
}
