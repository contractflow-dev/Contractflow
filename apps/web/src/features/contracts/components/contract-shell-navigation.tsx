"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { RiFileList3Line } from "@remixicon/react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Skeleton } from "@workspace/ui/components/skeleton";
import type { AppNavItem } from "@/components/app-shell/navigation";
import {
  ARCHIVED_STATUS,
  StatusBadge,
} from "@/components/status-badge/status-badge";
import {
  useGetContractByIdQuery,
  useGetContractWorkspaceAccessQuery,
} from "@/services/contractApi";
import { useContractSectionAccess } from "../_hooks/use-contract-section-access";
import {
  contractBreadcrumbs,
  contractNavigationGroups,
  type ContractCrumb,
} from "../contract-navigation";
import { CONTRACTS_PATH, contractSectionHref } from "../contract-sections";
import { projectPermissions } from "../project/project-rules";

export interface ContractShellNavigation {
  /** The contract's pages, for the shell's module sidebar. */
  module: AppNavItem;
  crumbs: readonly ContractCrumb[];
}

/**
 * Works out the open contract's navigation from the URL and the API, never
 * from remembered state. A contract the API refuses or can't find gets none,
 * so the company's navigation shows beside the page's own explanation.
 */
export function ContractNavigationBoundary({
  companyId,
  companyName,
  companyHref,
  contractId,
  children,
}: {
  companyId: string;
  companyName: string;
  companyHref: string;
  contractId: string;
  children: (navigation: ContractShellNavigation | null) => ReactNode;
}) {
  const pathname = usePathname();
  const query = { companyId, contractId };
  const contract = useGetContractByIdQuery(query);
  const workspaceAccess = useGetContractWorkspaceAccessQuery(query);
  const detail = contract.currentData;
  const sectionAccess = useContractSectionAccess({
    ...query,
    contract: detail?.contract,
  });

  if (contract.error) return <>{children(null)}</>;

  const base = {
    href: contractSectionHref(contractId, "overview"),
    label: "Contract",
    icon: RiFileList3Line,
    back: { href: CONTRACTS_PATH, label: "All contracts" },
  };

  if (!detail) {
    return (
      <>
        {children({
          module: {
            ...base,
            pageGroups: [],
            heading: (
              <div
                role="status"
                aria-label="Loading contract"
                className="space-y-2"
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-40" />
              </div>
            ),
          },
          crumbs: [],
        })}
      </>
    );
  }

  const workspaces = workspaceAccess.currentData?.workspaces ?? [];
  const projectRoles =
    workspaces.find(({ workspace }) => workspace === "project")?.roles ?? [];
  const groups = contractNavigationGroups({
    contractId,
    pathname,
    sectionAccess,
    workspaces,
    canReviewMilestones: projectPermissions({
      roles: projectRoles,
      partyType: detail.membership.partyType,
      contractStatus: detail.contract.status,
      archived: Boolean(detail.contract.deletedAt),
    }).isPlanner,
  });

  return (
    <>
      {children({
        module: {
          ...base,
          pageGroups: groups,
          heading: (
            <div className="min-w-0 space-y-1.5">
              <p className="truncate text-xs text-sidebar-foreground/70">
                Contract · {detail.contract.referenceNumber}
              </p>
              <p
                title={detail.contract.title}
                className="line-clamp-2 font-heading text-sm font-semibold break-words text-sidebar-accent-foreground"
              >
                {detail.contract.title}
              </p>
              <StatusBadge
                status={
                  detail.contract.deletedAt
                    ? ARCHIVED_STATUS
                    : detail.contract.status
                }
              />
            </div>
          ),
        },
        crumbs: contractBreadcrumbs({
          companyName,
          companyHref,
          reference: detail.contract.referenceNumber,
          contractId,
          pathname,
          groups,
        }),
      })}
    </>
  );
}

/** Where the open page sits, in the header from md. */
export function ContractBreadcrumbs({
  crumbs,
}: {
  crumbs: readonly ContractCrumb[];
}) {
  if (!crumbs.length) return null;
  return (
    <Breadcrumb className="hidden min-w-0 md:block">
      <BreadcrumbList>
        {crumbs.map((crumb, index) => (
          <Fragment key={`${crumb.label}-${index}`}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem className="min-w-0">
              {crumb.href ? (
                <BreadcrumbLink
                  className="max-w-40 truncate"
                  render={<Link href={crumb.href} />}
                >
                  {crumb.label}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="max-w-48 truncate">
                  {crumb.label}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
