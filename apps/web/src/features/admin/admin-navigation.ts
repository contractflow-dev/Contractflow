import {
  RiBankCardLine,
  RiBarChartBoxLine,
  RiBuilding4Line,
  RiDashboardLine,
  RiFileList3Line,
  RiFolderLine,
  RiGroupLine,
  RiHistoryLine,
  RiLayoutMasonryLine,
  RiMailSendLine,
  RiSettings4Line,
  RiShieldCheckLine,
  RiShieldKeyholeLine,
} from "@remixicon/react";
import type {
  AppNavGroup,
  AppNavItem,
} from "@/components/app-shell/navigation";

function planned(
  label: string,
  href: string,
  icon: AppNavItem["icon"],
): AppNavItem {
  return {
    label,
    href,
    icon,
    plannedNote: `${label} module is planned for an upcoming milestone`,
  };
}

/** Platform administration navigation. Only the overview is built so far. */
export const ADMIN_NAVIGATION: readonly AppNavGroup[] = [
  {
    label: "Core Control Plane",
    items: [
      {
        label: "Overview",
        href: "/admin",
        icon: RiDashboardLine,
        match: "exact",
      },
    ],
  },
  {
    label: "Tenancy & Access",
    items: [
      planned("Companies", "/admin/companies", RiBuilding4Line),
      planned("Users", "/admin/users", RiGroupLine),
      planned("Roles & Permissions", "/admin/roles", RiShieldKeyholeLine),
      planned("Workspaces", "/admin/workspaces", RiLayoutMasonryLine),
      planned("Invitations", "/admin/invitations", RiMailSendLine),
    ],
  },
  {
    label: "Operations & Governance",
    items: [
      planned("Contracts", "/admin/contracts", RiFileList3Line),
      planned("Compliance & HSE", "/admin/compliance", RiShieldCheckLine),
      planned("Documents", "/admin/documents", RiFolderLine),
      planned("Payments", "/admin/payments", RiBankCardLine),
    ],
  },
  {
    label: "Audit & Configuration",
    items: [
      planned("Activity Logs", "/admin/activity", RiHistoryLine),
      planned("Reports", "/admin/reports", RiBarChartBoxLine),
      planned("Settings", "/admin/settings", RiSettings4Line),
    ],
  },
];
