import {
  RiBarChartBoxLine,
  RiBuilding4Line,
  RiCalendarLine,
  RiFileList3Line,
  RiFolderShield2Line,
  RiGroupLine,
  RiQuestionLine,
  RiSettings3Line,
  RiTaskLine,
} from "@remixicon/react";
import type {
  AppNavGroup,
  AppNavItem,
} from "@/components/app-shell/navigation";
import {
  ClientPmDot,
  ContractorDot,
  FinanceDot,
  HseDot,
} from "./department-dots";

export type CompanyNavItem = AppNavItem & { adminOnly: boolean };

/**
 * A module that is planned but not built: listed, disabled, never a link.
 * Its href only keys the list.
 */
function planned(
  key: string,
  label: string,
  icon: AppNavItem["icon"],
  note: string,
): CompanyNavItem {
  return {
    href: `#planned-${key}`,
    label,
    icon,
    plannedNote: note,
    adminOnly: false,
  };
}

/**
 * Company workspace navigation, in groups. `adminOnly` items are shown only
 * when the server reports `membership.canManageCompany`; the API enforces
 * access.
 */
export const COMPANY_NAVIGATION_GROUPS: ReadonlyArray<{
  label?: string;
  items: readonly CompanyNavItem[];
}> = [
  {
    items: [
      {
        href: "/dashboards",
        label: "Overview",
        icon: RiBuilding4Line,
        match: "exact",
        adminOnly: true,
      },
      {
        href: "/dashboards/contracts",
        label: "Contracts",
        icon: RiFileList3Line,
        adminOnly: false,
      },
      {
        // Members read the company's documents; administrators manage them.
        href: "/dashboards/documents",
        label: "Company documents",
        icon: RiFolderShield2Line,
        adminOnly: false,
      },
      planned("tasks", "Tasks", RiTaskLine, "Task lists are planned."),
      planned(
        "calendar",
        "Calendar",
        RiCalendarLine,
        "A contract calendar is planned.",
      ),
      planned("reports", "Reports", RiBarChartBoxLine, "Reports are planned."),
    ],
  },
  {
    label: "Department workspaces",
    items: [
      planned(
        "contractor",
        "Contractor",
        ContractorDot,
        "The Contractor workspace is planned.",
      ),
      planned(
        "client-pm",
        "Client Project Mgmt",
        ClientPmDot,
        "The Client project management workspace is planned.",
      ),
      planned("hse", "HSE", HseDot, "The HSE workspace is planned."),
      planned(
        "finance",
        "Finance",
        FinanceDot,
        "The Finance workspace is planned.",
      ),
    ],
  },
  {
    items: [
      {
        href: "/dashboards/team",
        label: "Team",
        icon: RiGroupLine,
        adminOnly: true,
      },
      {
        href: "/dashboards/profile",
        label: "Company profile",
        icon: RiSettings3Line,
        adminOnly: true,
      },
      planned(
        "help",
        "Help & Support",
        RiQuestionLine,
        "Help and support are planned.",
      ),
    ],
  },
];

/** Every navigation item, for checks that don't care about grouping. */
export const COMPANY_NAVIGATION: readonly CompanyNavItem[] =
  COMPANY_NAVIGATION_GROUPS.flatMap(({ items }) => items);

/** The groups a member sees: administrator-only items need canManageCompany. */
export function companyNavigationFor(canManageCompany: boolean): AppNavGroup[] {
  return COMPANY_NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      ({ adminOnly }) => !adminOnly || canManageCompany,
    ),
  })).filter(({ items }) => items.length > 0);
}
