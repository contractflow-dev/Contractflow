import type { ComponentType } from "react";

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
}

export interface AppNavGroup {
  /** Shown above the group; omit for a single unlabelled list. */
  label?: string;
  items: readonly AppNavItem[];
}

export function isNavItemActive(pathname: string, item: AppNavItem): boolean {
  if (item.plannedNote) return false;
  if (pathname === item.href) return true;
  return item.match !== "exact" && pathname.startsWith(`${item.href}/`);
}
