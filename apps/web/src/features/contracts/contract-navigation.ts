import {
  RiBarChartBoxLine,
  RiDashboardLine,
  RiFileCheckLine,
  RiFlagLine,
  RiFolderLine,
  RiHistoryLine,
  RiListCheck3,
  RiMapPinLine,
  RiPenNibLine,
  RiShieldUserLine,
  RiTaskLine,
  RiTeamLine,
  RiBuilding2Line,
} from "@remixicon/react";
import type { ContractWorkspaceAccess } from "@contractflow/contracts-schema";
import {
  activeNavChild,
  type AppNavGroup,
  type AppNavItem,
} from "@/components/app-shell/navigation";
import {
  CONTRACTS_PATH,
  contractEditHref,
  contractSectionHref,
  isRestrictedContractSection,
  type ContractSection,
  type RestrictedContractSection,
} from "./contract-sections";
import {
  CONTRACT_WORKSPACES,
  contractWorkspaceHref,
  type ContractWorkspaceView,
} from "./contract-workspaces";

const CONTRACT_GROUP = "Contract";
const ADMINISTRATION_GROUP = "Administration";

const CONTRACT_PAGES: ReadonlyArray<{
  section: Exclude<ContractSection, "roles">;
  label: string;
  icon: AppNavItem["icon"];
}> = [
  { section: "overview", label: "Overview", icon: RiDashboardLine },
  { section: "parties", label: "Parties", icon: RiBuilding2Line },
  { section: "sites", label: "Sites", icon: RiMapPinLine },
  { section: "signatories", label: "Signatories", icon: RiPenNibLine },
  { section: "documents", label: "Documents", icon: RiFolderLine },
  { section: "history", label: "Status history", icon: RiHistoryLine },
];

const PROJECT_PAGES: ReadonlyArray<{
  view: ContractWorkspaceView;
  label: string;
  icon: AppNavItem["icon"];
}> = [
  { view: "stages", label: "Stages", icon: RiListCheck3 },
  { view: "milestones", label: "Milestones", icon: RiFlagLine },
  { view: "reviews", label: "Reviews", icon: RiFileCheckLine },
  { view: "activity", label: "Activity", icon: RiTaskLine },
];

/**
 * The contract a path belongs to, from the URL alone, or null on company
 * pages. `/dashboards/contracts/new` creates a contract and isn't one.
 */
export function contractIdFromPath(pathname: string): string | null {
  const match = /^\/dashboards\/contracts\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!match || match[1] === "new") return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * One contract's pages, grouped by what they belong to. Only built pages are
 * listed, and only those the API's permissions open to this viewer. Hiding an
 * entry is a convenience: the API decides access on every request.
 */
export function contractNavigationGroups({
  contractId,
  pathname,
  sectionAccess,
  workspaces,
  canReviewMilestones,
}: {
  contractId: string;
  pathname: string;
  sectionAccess: Record<RestrictedContractSection, boolean | undefined>;
  workspaces: readonly ContractWorkspaceAccess[];
  /** The viewer is the Client Project Manager who decides on submissions. */
  canReviewMilestones: boolean;
}): AppNavGroup[] {
  // A restricted section stays listed while it is open, so the page a shared
  // link landed on (which explains the refusal) is still marked as current.
  const sectionVisible = (section: ContractSection) =>
    !isRestrictedContractSection(section) ||
    sectionAccess[section] === true ||
    pathname === contractSectionHref(contractId, section);

  const groups: AppNavGroup[] = [
    {
      label: CONTRACT_GROUP,
      items: CONTRACT_PAGES.filter(({ section }) =>
        sectionVisible(section),
      ).map(({ section, label, icon }) => ({
        href: contractSectionHref(contractId, section),
        label,
        icon,
        ...(section === "overview"
          ? {
              match: "exact" as const,
              alsoActiveOn: [contractEditHref(contractId)],
            }
          : {}),
      })),
    },
  ];

  for (const { id, label } of CONTRACT_WORKSPACES) {
    const entry = workspaces.find(({ workspace }) => workspace === id);
    if (!entry?.hasAccess) continue;
    const items: AppNavItem[] = [
      {
        href: contractWorkspaceHref(contractId, id),
        label: `${label} overview`,
        icon: RiBarChartBoxLine,
        match: "exact",
      },
    ];
    if (id === "project") {
      for (const page of PROJECT_PAGES) {
        if (page.view === "reviews" && !canReviewMilestones) continue;
        items.push({
          href: contractWorkspaceHref(contractId, id, page.view),
          label: page.label,
          icon: page.icon,
        });
      }
    }
    if (entry.canManageTeam) {
      items.push({
        href: contractWorkspaceHref(contractId, id, "team"),
        label: `${label} team`,
        icon: RiTeamLine,
      });
    }
    groups.push({ label, items });
  }

  if (sectionVisible("roles")) {
    groups.push({
      label: ADMINISTRATION_GROUP,
      items: [
        {
          href: contractSectionHref(contractId, "roles"),
          label: "Role assignments",
          icon: RiShieldUserLine,
        },
      ],
    });
  }
  return groups;
}

export interface ContractCrumb {
  label: string;
  /** Absent on the current page. */
  href?: string;
}

/** Company, register, contract, workspace and page, from the URL. */
export function contractBreadcrumbs({
  companyName,
  companyHref,
  reference,
  contractId,
  pathname,
  groups,
}: {
  companyName: string;
  companyHref: string;
  reference: string;
  contractId: string;
  pathname: string;
  groups: readonly AppNavGroup[];
}): ContractCrumb[] {
  const contractHref = contractSectionHref(contractId, "overview");
  const lead: ContractCrumb[] = [
    { label: companyName, href: companyHref },
    { label: "Contracts", href: CONTRACTS_PATH },
  ];
  if (pathname === contractHref) return [...lead, { label: reference }];

  const crumbs = [...lead, { label: reference, href: contractHref }];
  const pages = groups.flatMap(({ items }) => items);
  const active = activeNavChild(pathname, pages);
  if (!active) return crumbs;

  const group = groups.find(({ items }) => items.includes(active));
  const inWorkspace =
    group?.label !== CONTRACT_GROUP && group?.label !== ADMINISTRATION_GROUP;
  if (group?.label && inWorkspace) {
    const landing = group.items[0].href;
    if (pathname === landing) return [...crumbs, { label: group.label }];
    crumbs.push({ label: group.label, href: landing });
  }
  if (active.href !== contractHref) {
    crumbs.push({
      label: active.label,
      href: pathname === active.href ? undefined : active.href,
    });
  }
  if (pathname !== active.href) {
    crumbs.push({
      label:
        pathname === contractEditHref(contractId) ? "Edit details" : "Details",
    });
  }
  return crumbs;
}
