import {
  RiAddCircleLine,
  RiBuilding4Line,
  RiCalendarLine,
  RiFileList3Line,
  RiFolderShield2Line,
  RiGroupLine,
  RiOrganizationChart,
  RiQuestionLine,
  RiSettings3Line,
  RiTaskLine,
} from "@remixicon/react";
import {
  flattenNavItems,
  type AppNavGroup,
  type AppNavItem,
} from "@/components/app-shell/navigation";
import { FinanceDot, HseDot, ProjectDot } from "./department-dots";

export type CompanyNavItem = Omit<AppNavItem, "children"> & {
  adminOnly: boolean;
  /** Shown only to members who aren't Company Administrators. */
  membersOnly?: boolean;
  /** The module's pages, each with its own visibility. */
  children?: readonly CompanyNavItem[];
};

/** The department page that looks at one contract workspace. */
export function departmentHref(
  department: "project" | "hse" | "finance",
): string {
  return `/dashboards/departments/${department}`;
}

/**
 * A department for Company Administrators: a read-only oversight page of the
 * contracts with that workspace. Project covers both sides: the page's
 * party-type filter tells client from contractor contracts.
 */
function department(
  href: string,
  label: string,
  icon: AppNavItem["icon"],
): CompanyNavItem {
  return { href, label, icon, adminOnly: true };
}

/** The same department for members: still planned for role holders. */
function plannedDepartment(
  key: string,
  label: string,
  icon: AppNavItem["icon"],
  note: string,
): CompanyNavItem {
  return { ...planned(key, label, icon, note), membersOnly: true };
}

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
        description: "Contracts your company is a party to.",
        // A contract's own pages (/dashboards/contracts/:id/...) stay under
        // the register; they have their own section tabs.
        children: [
          {
            href: "/dashboards/contracts",
            label: "Contract register",
            icon: RiFileList3Line,
            adminOnly: false,
          },
          {
            // The API also allows only Company Administrators to create.
            href: "/dashboards/contracts/new",
            label: "New contract",
            icon: RiAddCircleLine,
            match: "exact",
            adminOnly: true,
          },
        ],
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
    ],
  },
  {
    label: "Department workspaces",
    items: [
      {
        href: departmentHref("project"),
        label: "Departments",
        icon: RiOrganizationChart,
        adminOnly: true,
        description: "Read-only oversight of each contract workspace.",
        children: [
          department(departmentHref("project"), "Project", ProjectDot),
          department(departmentHref("hse"), "HSE", HseDot),
          department(departmentHref("finance"), "Finance", FinanceDot),
        ],
      },
      plannedDepartment(
        "project",
        "Project",
        ProjectDot,
        "The Project workspace is planned.",
      ),
      plannedDepartment("hse", "HSE", HseDot, "The HSE workspace is planned."),
      plannedDepartment(
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

/**
 * Every destination, modules' pages included, for checks that don't care
 * about grouping, such as which routes are for administrators only.
 */
export const COMPANY_NAVIGATION: readonly CompanyNavItem[] = flattenNavItems(
  COMPANY_NAVIGATION_GROUPS.flatMap(({ items }) => items),
) as readonly CompanyNavItem[];

/**
 * The groups a member sees: administrator-only items need canManageCompany,
 * and members-only items (the planned departments) are for everyone else.
 * A module's pages are filtered the same way, so a module never lists a page
 * its reader can't open. The API enforces access either way.
 */
export function companyNavigationFor(canManageCompany: boolean): AppNavGroup[] {
  const visible = ({ adminOnly, membersOnly }: CompanyNavItem) =>
    canManageCompany ? !membersOnly : !adminOnly;
  return COMPANY_NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter(visible)
      .map(({ children, ...item }) =>
        children ? { ...item, children: children.filter(visible) } : item,
      ),
  })).filter(({ items }) => items.length > 0);
}
