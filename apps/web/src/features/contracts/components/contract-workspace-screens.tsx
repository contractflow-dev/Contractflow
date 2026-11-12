"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  RiArrowRightLine,
  RiShieldUserLine,
  RiTeamLine,
} from "@remixicon/react";
import type {
  AssignableContractWorkspace,
  ContractWorkspaceAccess,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@/components/status-badge/status-badge";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import {
  useGetContractByIdQuery,
  useGetContractWorkspaceAccessQuery,
  useGetContractWorkspaceQuery,
} from "@/services/contractApi";
import { useContractSectionAccess } from "../_hooks/use-contract-section-access";
import {
  CONTRACT_SECTIONS,
  CONTRACT_UNAVAILABLE_TEXT,
  contractSectionHref,
  isRestrictedContractSection,
} from "../contract-sections";
import {
  contractWorkspaceHref,
  workspaceMeta,
  type ContractWorkspaceView as WorkspaceView,
} from "../contract-workspaces";
import { ContractRoleAssignmentManagement } from "./contract-role-assignment-management";

const tabClass = (active: boolean) =>
  cn(
    "-mb-px inline-flex min-h-10 items-center gap-2 rounded-t-xl border-b-2 px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
    active
      ? "border-primary font-semibold text-foreground"
      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
  );

/**
 * A contract's Project, HSE or Finance workspace: the contract it belongs to,
 * the workspaces the member can enter, the workspace's own sections, and the
 * view. Everything shown comes from the API; the workspace itself is opened
 * only when `GET /contract/workspaces/:workspace` allows it (the API refuses
 * members without a role there, Company Administrators included).
 */
export function ContractWorkspace({
  companyId,
  contractId,
  workspace,
  view,
}: {
  companyId: string;
  contractId: string;
  workspace: AssignableContractWorkspace;
  view: WorkspaceView;
}) {
  const query = { companyId, contractId };
  const contract = useGetContractByIdQuery(query);
  const access = useGetContractWorkspaceAccessQuery(query);
  const current = useGetContractWorkspaceQuery({ ...query, workspace });
  const meta = workspaceMeta(workspace);
  const detail = contract.currentData;

  if (contract.isLoading || current.isLoading) {
    return (
      <div role="status" aria-label="Loading workspace" className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (contract.error || !detail) {
    const notFound = getApiErrorStatus(contract.error) === 404;
    return (
      <WorkspaceProblem
        title={
          notFound ? "Contract was not found" : "This contract could not be loaded"
        }
        text={
          notFound
            ? CONTRACT_UNAVAILABLE_TEXT
            : getApiErrorMessage(contract.error, "Try again in a moment.")
        }
        // Retrying can't make a contract the API hides from you appear.
        action={
          notFound ? undefined : (
            <Button
              type="button"
              variant="outline"
              onClick={() => void contract.refetch()}
            >
              Retry
            </Button>
          )
        }
      />
    );
  }

  const entered = current.currentData;
  const status = getApiErrorStatus(current.error);
  const enterable = (access.currentData?.workspaces ?? []).filter(
    (entry) => entry.hasAccess,
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          className="text-sm text-primary underline-offset-4 hover:underline"
          href={contractSectionHref(contractId, "overview")}
        >
          Back to contract
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm break-words text-muted-foreground">
              {detail.contract.referenceNumber} · {detail.contract.title}
            </p>
            <h1 className="mt-1 type-page-title">{meta.label} workspace</h1>
          </div>
          <StatusBadge status={detail.contract.status} />
        </div>
      </div>

      {enterable.length > 0 ? (
        <nav aria-label="Workspaces" className="-mx-1 overflow-x-auto px-1">
          <ul className="flex min-w-max gap-1 border-b">
            {enterable.map((entry) => (
              <li key={entry.workspace}>
                <Link
                  href={contractWorkspaceHref(contractId, entry.workspace)}
                  aria-current={
                    entry.workspace === workspace ? "page" : undefined
                  }
                  className={tabClass(entry.workspace === workspace)}
                >
                  {workspaceMeta(entry.workspace).label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {entered ? (
        <>
          <nav aria-label={`${meta.label} workspace sections`}>
            <ul className="flex flex-wrap gap-2">
              <li>
                <SectionLink
                  href={contractWorkspaceHref(contractId, workspace)}
                  active={view === "overview"}
                >
                  Overview
                </SectionLink>
              </li>
              {entered.canManageTeam ? (
                <li>
                  <SectionLink
                    href={contractWorkspaceHref(contractId, workspace, "team")}
                    active={view === "team"}
                  >
                    <RiTeamLine className="size-4" aria-hidden="true" />
                    Team
                  </SectionLink>
                </li>
              ) : null}
            </ul>
          </nav>
          {view === "team" ? (
            entered.canManageTeam ? (
              <ContractRoleAssignmentManagement
                companyId={companyId}
                contractId={contractId}
                fixedWorkspace={workspace}
              />
            ) : (
              <WorkspaceProblem
                title="Team management is for Workspace Admins"
                text={`Your ${meta.label} workspace administrator manages who is on this team.`}
              />
            )
          ) : (
            <WorkspaceOverview
              companyId={companyId}
              contractId={contractId}
              access={entered}
              contractDeleted={Boolean(detail.contract.deletedAt)}
            />
          )}
        </>
      ) : status === 403 ? (
        <WorkspaceProblem
          title={`You don't have access to the ${meta.label} workspace`}
          text={
            enterable.length
              ? `Entering it needs a ${meta.label} role on this contract. You can use the workspaces above.`
              : `Entering it needs a ${meta.label} role on this contract. A Company Administrator, or the workspace's administrator, can assign one.`
          }
        />
      ) : status === 404 ? (
        <WorkspaceProblem
          title={`This contract has no ${meta.label} workspace`}
          text="A Company Administrator can add workspaces to the contract."
        />
      ) : (
        <WorkspaceProblem
          title="The workspace could not be loaded"
          text={getApiErrorMessage(current.error, "Try again in a moment.")}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => void current.refetch()}
            >
              Retry
            </Button>
          }
        />
      )}
    </div>
  );
}

function SectionLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-2xl border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        active
          ? "border-primary/40 bg-accent font-medium text-accent-foreground"
          : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function WorkspaceProblem({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
      {action ? <CardContent>{action}</CardContent> : null}
    </Card>
  );
}

/**
 * A workspace's landing screen: what it is for, the member's own role, the
 * contract sections that already hold its records, and what is planned.
 * Nothing here is invented: roles come from the API, sections are existing
 * pages, and planned items are labelled as not yet available.
 */
function WorkspaceOverview({
  companyId,
  contractId,
  access,
  contractDeleted,
}: {
  companyId: string;
  contractId: string;
  access: ContractWorkspaceAccess;
  contractDeleted: boolean;
}) {
  const meta = workspaceMeta(access.workspace);
  const contract = useGetContractByIdQuery({ companyId, contractId });
  const sectionAccess = useContractSectionAccess({
    companyId,
    contractId,
    contract: contract.currentData?.contract,
  });
  const sections = meta.sections.filter(
    (section) =>
      !isRestrictedContractSection(section) || sectionAccess[section] === true,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>About this workspace</h2>
            </CardTitle>
            <CardDescription>{meta.purpose}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <h3 className="type-subsection-title">Available now</h3>
            {sections.length ? (
              <ul className="divide-y rounded-2xl border">
                {sections.map((section) => (
                  <li key={section}>
                    <Link
                      href={contractSectionHref(contractId, section)}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-2xl px-4 py-2 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
                    >
                      <span>
                        {
                          CONTRACT_SECTIONS.find(({ id }) => id === section)
                            ?.label
                        }
                        <span className="sr-only"> (contract section)</span>
                      </span>
                      <RiArrowRightLine
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No contract sections are open to you yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Coming to this workspace</h2>
            </CardTitle>
            <CardDescription>
              These are planned and not available yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {meta.planned.map((item) => (
                <li
                  key={item}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0 break-words">{item}</span>
                  <Badge variant="outline" className="font-normal">
                    Planned
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="self-start">
        <CardHeader>
          <CardTitle>
            <h2>Your access</h2>
          </CardTitle>
          <CardDescription>
            Granted by your contract role, not by company rights.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <p className="text-muted-foreground">
              {access.roles.length === 1 ? "Your role" : "Your roles"}
            </p>
            <ul className="flex flex-wrap gap-2">
              {access.roles.map((role) => (
                <li key={role}>
                  <Badge variant="secondary">{role}</Badge>
                </li>
              ))}
            </ul>
          </div>
          {access.isWorkspaceAdmin ? (
            <p className="flex items-center gap-2">
              <RiShieldUserLine
                className="size-4 text-primary"
                aria-hidden="true"
              />
              Workspace Admin
            </p>
          ) : null}
          {access.canManageTeam ? (
            <Link
              href={contractWorkspaceHref(contractId, access.workspace, "team")}
              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
            >
              Manage the {meta.label} team
              <RiArrowRightLine className="size-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <p className="text-muted-foreground">
              Your workspace administrator manages who is on this team.
            </p>
          )}
          {contractDeleted ? (
            <Alert>
              <AlertDescription>This contract is archived.</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * The workspaces entry on a contract's Overview: links to the workspaces
 * the member holds a role in, or why there are none. The API decides access
 * again when a workspace is opened.
 */
export function ContractWorkspacesCard({
  companyId,
  contractId,
  canAssignRoles,
}: {
  companyId: string;
  contractId: string;
  /** The viewer can use the Roles section (to suggest it when empty). */
  canAssignRoles?: boolean;
}) {
  const access = useGetContractWorkspaceAccessQuery({ companyId, contractId });
  const data = access.currentData;
  const enterable = (data?.workspaces ?? []).filter((entry) => entry.hasAccess);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Your workspaces</h2>
        </CardTitle>
        <CardDescription>
          Project, HSE and Finance workspaces open to people with a role in them
          on this contract.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {access.isLoading ? (
          <div
            role="status"
            aria-label="Loading your workspaces"
            className="space-y-2"
          >
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : access.error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {getApiErrorMessage(
                  access.error,
                  "Unable to load your workspaces.",
                )}
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => void access.refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : enterable.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enterable.map((entry) => (
              <li key={entry.workspace}>
                <Link
                  href={contractWorkspaceHref(contractId, entry.workspace)}
                  className="flex h-full flex-col gap-1 rounded-2xl border bg-card p-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <span className="flex items-center justify-between gap-2 font-medium">
                    {workspaceMeta(entry.workspace).label} workspace
                    <RiArrowRightLine
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {entry.roles.join(", ")}
                    {entry.isWorkspaceAdmin ? " · Workspace Admin" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {(data?.workspaces.length ?? 0) === 0
              ? "This contract has no workspaces yet."
              : `You don't hold a role in this contract's ${listWorkspaces(data?.workspaces ?? [])} workspace${(data?.workspaces.length ?? 0) > 1 ? "s" : ""}.`}{" "}
            {canAssignRoles
              ? "As a Company Administrator you can view this contract's details, parties and history, but workspaces, activity and documents need a contract role. You can assign roles, including your own, in the Roles section."
              : "A Company Administrator or a workspace administrator can assign you one."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function listWorkspaces(entries: ContractWorkspaceAccess[]): string {
  const labels = entries.map((entry) => workspaceMeta(entry.workspace).label);
  return labels.length > 1
    ? `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`
    : (labels[0] ?? "");
}
