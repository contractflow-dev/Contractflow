import {
  RiBuilding4Line,
  RiFileList3Line,
  RiGroupLine,
  RiSettings3Line,
} from "@remixicon/react";
import type { AppNavItem } from "@/components/app-shell/navigation";

/**
 * Company workspace navigation. `adminOnly` items are shown only when the
 * server reports `membership.canManageCompany`; the API enforces access.
 */
export const COMPANY_NAVIGATION: ReadonlyArray<
  AppNavItem & { adminOnly: boolean }
> = [
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
];
