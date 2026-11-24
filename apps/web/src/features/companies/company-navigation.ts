import {
  RiAddCircleLine,
  RiBuilding4Line,
  RiFileList3Line,
  RiFolderShield2Line,
  RiGroupLine,
  RiMailSendLine,
  RiSettings3Line,
  RiShieldUserLine,
  RiTeamLine,
  RiUserAddLine,
} from "@remixicon/react";
import {
  flattenNavItems,
  isNavItemActive,
  type AppNavGroup,
  type AppNavItem,
} from "@/components/app-shell/navigation";

export type CompanyNavItem = Omit<AppNavItem, "children"> & {
  adminOnly: boolean;
  /** The module's pages, each with its own visibility. */
  children?: readonly CompanyNavItem[];
};

/** The Team module's pages. */
export const TEAM_PATH = "/dashboards/team";
export const TEAM_CONTRACT_ROLES_PATH = "/dashboards/team/contract-roles";

/** The dialogs the Team pages open from `?dialog=`. */
export const TEAM_DIALOGS = ["invitations", "invite"] as const;
export type TeamDialog = (typeof TEAM_DIALOGS)[number];

/**
 * The read-only department oversight pages. They are not in the navigation,
 * but the route remains, for Company Administrators only.
 */
const DEPARTMENTS_PATH = "/dashboards/departments";

/**
 * Company workspace navigation, in groups: only what belongs to the company
 * and is built. A contract's own pages, its Project, HSE and Finance
 * workspaces included, are in that contract's navigation. `adminOnly` items
 * are shown only when the server reports `membership.canManageCompany`; the
 * API enforces access.
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
    ],
  },
  {
    items: [
      {
        href: "/dashboards/contracts",
        label: "Contracts",
        icon: RiFileList3Line,
        adminOnly: false,
        description: "Contracts your company is a party to.",
        // An open contract replaces these pages with its own navigation.
        children: [
          {
            href: "/dashboards/contracts",
            label: "All Contracts",
            icon: RiFileList3Line,
            adminOnly: false,
          },
          {
            // The API also allows only Company Administrators to create.
            href: "/dashboards/contracts/new",
            label: "New Contract",
            icon: RiAddCircleLine,
            match: "exact",
            adminOnly: true,
          },
        ],
      },
    ],
  },
  {
    label: "Company",
    items: [
      {
        // Members read the company's documents; administrators manage them.
        href: "/dashboards/documents",
        label: "Documents",
        icon: RiFolderShield2Line,
        adminOnly: false,
      },
      {
        href: TEAM_PATH,
        label: "Team",
        icon: RiGroupLine,
        adminOnly: true,
        description: "Company members, their contract roles and invitations.",
        children: [
          {
            href: TEAM_PATH,
            label: "Company members",
            icon: RiTeamLine,
            match: "exact",
            adminOnly: true,
          },
          {
            href: TEAM_CONTRACT_ROLES_PATH,
            label: "Contract roles",
            icon: RiShieldUserLine,
            adminOnly: true,
          },
          // Dialogs over the Team page that is open; see teamDialogs.
          {
            href: TEAM_PATH,
            label: "Invitations",
            icon: RiMailSendLine,
            dialog: "invitations",
            adminOnly: true,
          },
          {
            href: TEAM_PATH,
            label: "Invite member",
            icon: RiUserAddLine,
            dialog: "invite",
            adminOnly: true,
          },
        ],
      },
      {
        href: "/dashboards/profile",
        label: "Profile",
        icon: RiSettings3Line,
        adminOnly: true,
      },
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

/** Whether the path is a page only Company Administrators may open. */
export function isCompanyAdminRoute(pathname: string): boolean {
  return (
    pathname === DEPARTMENTS_PATH ||
    pathname.startsWith(`${DEPARTMENTS_PATH}/`) ||
    COMPANY_NAVIGATION.some(
      (item) => item.adminOnly && isNavItemActive(pathname, item),
    )
  );
}

/**
 * The groups a member sees: administrator-only items need canManageCompany.
 * A module's pages are filtered the same way, so a module never lists a page
 * its reader can't open. The API enforces access either way.
 */
export function companyNavigationFor(canManageCompany: boolean): AppNavGroup[] {
  const visible = ({ adminOnly }: CompanyNavItem) =>
    canManageCompany || !adminOnly;
  return COMPANY_NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter(visible)
      .map(({ children, ...item }) =>
        children ? { ...item, children: children.filter(visible) } : item,
      ),
  })).filter(({ items }) => items.length > 0);
}
