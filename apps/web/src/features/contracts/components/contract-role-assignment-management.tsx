"use client";

import { useState, type ReactNode } from "react";
import { RiMailSendLine, RiUserAddLine } from "@remixicon/react";
import type { ContractActivityTarget } from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import {
  DataTable,
  DataTableEmpty,
  DataTableRowActions,
  type DataTableColumn,
} from "@/components/data-table/data-table";
import { ListCard } from "@/components/data-table/list-card";
import { DropdownMenuItem } from "@workspace/ui/components/dropdown-menu";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDate, humanizeEnumValue } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import {
  useGetContractRoleAssignmentsQuery,
  useGetContractRoleManagementPermissionsQuery,
  useGetContractWorkspacesQuery,
  useRevokeContractRoleMutation,
  useSetContractWorkspaceAdminMutation,
  type AssignableContractWorkspace,
  type ContractRoleAssignment,
} from "@/services/contractApi";
import {
  AssignMemberDialog,
  ContractRoleInvitationsSheet,
} from "./contract-role-dialogs";
import {
  ContractRoleLabels,
  useContractRoleLabel,
  useContractSideLabel,
} from "./contract-role-labels";

const workspaceOptions: AssignableContractWorkspace[] = [
  "project",
  "hse",
  "finance",
];

/** A workspace's role assignments, with dates in the viewer's time zone. */
function assignmentColumns(
  timeZone: string | undefined,
  roleLabel: (role: string) => string,
): ReadonlyArray<DataTableColumn<ContractRoleAssignment>> {
  return [
    {
      id: "member",
      header: "Member",
      wrap: true,
      className: "min-w-40",
      cell: (assignment) => (
        <>
          <p className="font-medium">{memberName(assignment)}</p>
          <p className="text-sm text-muted-foreground">{assignment.email}</p>
        </>
      ),
    },
    {
      id: "role",
      header: "Role",
      wrap: true,
      cell: (assignment) => (
        <>
          <p>{roleLabel(assignment.role)}</p>
          {assignment.isWorkspaceAdmin ? (
            <p className="text-xs font-medium text-primary">Workspace Admin</p>
          ) : null}
        </>
      ),
    },
    {
      id: "assigned",
      header: "Assigned",
      className: "tabular-nums",
      cell: (assignment) => formatDate(assignment.assignedAt, { timeZone }),
    },
  ];
}

const memberName = (assignment: ContractRoleAssignment) =>
  `${assignment.firstName} ${assignment.lastName}`.trim() || assignment.email;

/**
 * The contract's role assignments. On a subcontract the roles read
 * "Main Contractor …" and "Subcontractor …".
 */
export function ContractRoleAssignmentManagement({
  isSubcontract = false,
  ...props
}: RoleAssignmentManagementProps & {
  /** The contract is a subcontract (for the roles' names). */
  isSubcontract?: boolean;
}) {
  return (
    <ContractRoleLabels isSubcontract={isSubcontract}>
      <RoleAssignmentManagement {...props} />
    </ContractRoleLabels>
  );
}

type RoleAssignmentManagementProps = {
  companyId: string;
  contractId: string;
  /** Reference and title, naming the contract in the invitations panel. */
  contractLabel?: string;
  /** The workspace the assign and invite actions start on (?workspace=). */
  initialWorkspace?: AssignableContractWorkspace;
  /**
   * Manage only this workspace (inside a workspace's Team screen): the
   * workspace selector is hidden. The API checks access for it as always.
   */
  fixedWorkspace?: AssignableContractWorkspace;
  target?: ContractActivityTarget | null;
};

function RoleAssignmentManagement({
  companyId,
  contractId,
  contractLabel,
  fixedWorkspace,
  initialWorkspace,
  target,
}: RoleAssignmentManagementProps) {
  const roleLabel = useContractRoleLabel();
  const sideName = useContractSideLabel();
  const scope = { companyId, contractId };
  const otherWorkspace = (option: AssignableContractWorkspace) =>
    Boolean(fixedWorkspace) && option !== fixedWorkspace;
  const permissionQueries = {
    project: useGetContractRoleManagementPermissionsQuery(
      { ...scope, workspace: "project" },
      { skip: otherWorkspace("project") },
    ),
    hse: useGetContractRoleManagementPermissionsQuery(
      { ...scope, workspace: "hse" },
      { skip: otherWorkspace("hse") },
    ),
    finance: useGetContractRoleManagementPermissionsQuery(
      { ...scope, workspace: "finance" },
      { skip: otherWorkspace("finance") },
    ),
  };
  const enabled = useGetContractWorkspacesQuery(scope, {
    skip: Boolean(fixedWorkspace),
  });
  // Only workspaces this viewer may manage are offered in the dialogs.
  const manageable = workspaceOptions.filter(
    (option) =>
      permissionQueries[option].data?.canManage === true &&
      (fixedWorkspace
        ? option === fixedWorkspace
        : (enabled.data ?? []).includes(option)),
  );
  const startWorkspace =
    manageable.find(
      (option) => option === (target?.workspace ?? initialWorkspace),
    ) ?? manageable[0];

  // The workspace the Assign Member dialog is open on, or null when closed.
  const [assigningIn, setAssigningIn] =
    useState<AssignableContractWorkspace | null>(null);
  // A link to one invitation opens the panel that lists it.
  const [invitationsOpen, setInvitationsOpen] = useState(
    target?.type === "contract_role_invitation",
  );
  const [linkedTarget, setLinkedTarget] = useState(target?.id);
  if (linkedTarget !== target?.id) {
    setLinkedTarget(target?.id);
    if (target?.type === "contract_role_invitation") setInvitationsOpen(true);
  }
  const [revokeWorkspace, setRevokeWorkspace] =
    useState<AssignableContractWorkspace>(
      fixedWorkspace ?? initialWorkspace ?? "project",
    );
  const [assignmentToRevoke, setAssignmentToRevoke] =
    useState<ContractRoleAssignment | null>(null);
  // Row-action failures are shown inline; confirmation failures in its dialog.
  const [failure, setFailure] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState("");
  const timeZone = useUserTimeZone();
  const fixedPermissions = fixedWorkspace
    ? permissionQueries[fixedWorkspace]
    : null;
  const assignmentsQuery = useGetContractRoleAssignmentsQuery(
    { ...scope, workspace: fixedWorkspace ?? "project" },
    { skip: !fixedWorkspace || fixedPermissions?.data?.canManage !== true },
  );
  const [revokeRole, revokeState] = useRevokeContractRoleMutation();
  const [setWorkspaceAdmin, workspaceAdminState] =
    useSetContractWorkspaceAdminMutation();

  async function changeWorkspaceAdmin(
    assignment: ContractRoleAssignment,
    assignmentWorkspace: AssignableContractWorkspace,
  ) {
    setFailure(null);
    try {
      await setWorkspaceAdmin({
        ...scope,
        workspace: assignmentWorkspace,
        assignmentId: assignment.id,
        isWorkspaceAdmin: !assignment.isWorkspaceAdmin,
      }).unwrap();
      notifySuccess(
        assignment.isWorkspaceAdmin
          ? "Workspace administrator removed"
          : "Workspace administrator granted",
        assignment.isWorkspaceAdmin
          ? `${memberName(assignment)} is no longer a workspace administrator.`
          : `${memberName(assignment)} can now manage this workspace.`,
      );
    } catch (error) {
      setFailure(
        getApiErrorMessage(
          error,
          "Unable to update workspace administrator access.",
        ),
      );
    }
  }

  async function confirmRevocation() {
    if (!assignmentToRevoke || revokeState.isLoading) return;
    setDialogError("");
    try {
      await revokeRole({
        ...scope,
        workspace: revokeWorkspace,
        assignmentId: assignmentToRevoke.id,
      }).unwrap();
      notifySuccess(
        "Contract role revoked",
        `${memberName(assignmentToRevoke)} no longer has ${roleLabel(assignmentToRevoke.role)}.`,
      );
      setAssignmentToRevoke(null);
    } catch (error) {
      setDialogError(
        getApiErrorMessage(error, "Unable to revoke this contract role."),
      );
    }
  }

  const actions: ReactNode = startWorkspace ? (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        aria-haspopup="dialog"
        onClick={() => setInvitationsOpen(true)}
      >
        <RiMailSendLine aria-hidden="true" data-icon="inline-start" />
        Contract Role Invitations
      </Button>
      <Button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setAssigningIn(startWorkspace)}
      >
        <RiUserAddLine aria-hidden="true" data-icon="inline-start" />
        Assign Member
      </Button>
    </div>
  ) : null;

  const overlays = (
    <>
      {startWorkspace ? (
        <>
          <AssignMemberDialog
            {...scope}
            workspaces={manageable}
            initialWorkspace={assigningIn ?? startWorkspace}
            open={assigningIn !== null}
            onOpenChange={(open) => {
              if (!open) setAssigningIn(null);
            }}
          />
          <ContractRoleInvitationsSheet
            {...scope}
            workspaces={manageable}
            initialWorkspace={startWorkspace}
            contractLabel={contractLabel}
            target={target}
            open={invitationsOpen}
            onOpenChange={setInvitationsOpen}
          />
        </>
      ) : null}
      <ConfirmDialog
        open={assignmentToRevoke !== null}
        title={
          assignmentToRevoke
            ? `Revoke ${roleLabel(assignmentToRevoke.role)}?`
            : "Revoke this contract role?"
        }
        description={
          assignmentToRevoke
            ? `${memberName(assignmentToRevoke)} will lose access to the ${humanizeEnumValue(revokeWorkspace)} workspace of this contract. You can assign the role again later.`
            : ""
        }
        confirmLabel="Revoke role"
        pendingLabel="Revoking…"
        isPending={revokeState.isLoading}
        error={assignmentToRevoke ? dialogError : undefined}
        destructive
        onConfirm={() => void confirmRevocation()}
        onCancel={() => setAssignmentToRevoke(null)}
      />
    </>
  );

  const failureAlert = failure ? (
    <Alert variant="destructive">
      <AlertDescription>{failure}</AlertDescription>
    </Alert>
  ) : null;

  if (!fixedWorkspace) {
    const permissionError = workspaceOptions
      .map((option) => permissionQueries[option].error)
      .find(Boolean);
    return (
      <>
        {permissionError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {getApiErrorMessage(
                permissionError,
                "Unable to verify contract role management access.",
              )}
            </AlertDescription>
          </Alert>
        ) : null}
        {failureAlert}
        <ContractWorkspaceTeams
          companyId={companyId}
          contractId={contractId}
          target={target}
          busy={workspaceAdminState.isLoading || revokeState.isLoading}
          actions={actions}
          onAdd={setAssigningIn}
          onToggleAdmin={(assignment, next) =>
            void changeWorkspaceAdmin(assignment, next)
          }
          onRevoke={(assignment, next) => {
            setDialogError("");
            setRevokeWorkspace(next);
            setAssignmentToRevoke(assignment);
          }}
        />
        {overlays}
      </>
    );
  }

  if (fixedPermissions?.isLoading) return null;
  if (fixedPermissions?.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {getApiErrorMessage(
            fixedPermissions.error,
            "Unable to verify contract role management access.",
          )}
        </AlertDescription>
      </Alert>
    );
  }
  const permissions = fixedPermissions?.data;
  if (!permissions?.canManage) return null;
  const sideLabel = sideName(
    permissions.roleSide === "client" ? "client" : "contractor",
  );

  return (
    <>
      <ListCard
        title="Contract role assignments"
        description={`Manage active roles for members of your company. Contract access ends when an assignment is revoked. Your company is on the ${sideLabel} side of this contract, so only ${sideLabel} roles are offered.`}
        action={actions}
      >
        {failureAlert}
        {/* Narrow enough for phones once the actions sit in a menu, so one
            table serves every width and deep links keep a single target. */}
        <DataTable
          label="Role assignments"
          columns={assignmentColumns(timeZone, roleLabel)}
          rows={assignmentsQuery.data ?? []}
          getRowKey={(assignment) => assignment.id}
          getRowProps={(assignment) => ({
            id: `activity-target-${assignment.id}`,
            className:
              target?.type === "contract_role_assignment" &&
              target.id === assignment.id
                ? "bg-primary/10"
                : undefined,
          })}
          rowActions={(assignment) => (
            <DataTableRowActions
              label={`Actions for ${memberName(assignment)}, ${roleLabel(assignment.role)}`}
            >
              {permissions.canGrantWorkspaceAdmin ? (
                <DropdownMenuItem
                  disabled={workspaceAdminState.isLoading}
                  onClick={() =>
                    void changeWorkspaceAdmin(assignment, fixedWorkspace)
                  }
                >
                  {assignment.isWorkspaceAdmin
                    ? "Remove workspace admin"
                    : "Make workspace admin"}
                </DropdownMenuItem>
              ) : null}
              {/* Revoking asks for confirmation first. */}
              <DropdownMenuItem
                variant="destructive"
                disabled={revokeState.isLoading}
                onClick={() => {
                  setDialogError("");
                  setRevokeWorkspace(fixedWorkspace);
                  setAssignmentToRevoke(assignment);
                }}
              >
                Revoke role…
              </DropdownMenuItem>
            </DataTableRowActions>
          )}
          isLoading={assignmentsQuery.isLoading}
          loadingLabel="Loading role assignments…"
          skeletonRows={3}
          error={
            assignmentsQuery.error
              ? getApiErrorMessage(
                  assignmentsQuery.error,
                  "Unable to load contract role assignments.",
                )
              : null
          }
          onRetry={() => void assignmentsQuery.refetch()}
          empty={
            <DataTableEmpty title="No active roles are assigned in this workspace." />
          }
        />
      </ListCard>
      {overlays}
    </>
  );
}

const formatLabel = humanizeEnumValue;

const WORKSPACE_DOTS: Record<AssignableContractWorkspace, string> = {
  project: "bg-dept-client-pm",
  hse: "bg-dept-hse",
  finance: "bg-dept-finance",
};

/**
 * The contract's enabled workspaces side by side, each with the company's
 * people in it (prototype D5). Actions go through the parent, which owns
 * the confirmation and the mutations; the API checks every change again.
 */
function ContractWorkspaceTeams({
  companyId,
  contractId,
  target,
  busy,
  actions,
  onAdd,
  onToggleAdmin,
  onRevoke,
}: {
  companyId: string;
  contractId: string;
  target?: ContractActivityTarget | null;
  busy: boolean;
  /** Assign Member and Contract Role Invitations, beside the heading. */
  actions?: ReactNode;
  onAdd: (workspace: AssignableContractWorkspace) => void;
  onToggleAdmin: (
    assignment: ContractRoleAssignment,
    workspace: AssignableContractWorkspace,
  ) => void;
  onRevoke: (
    assignment: ContractRoleAssignment,
    workspace: AssignableContractWorkspace,
  ) => void;
}) {
  const enabled = useGetContractWorkspacesQuery({ companyId, contractId });
  const workspaces = enabled.data ?? [];
  return (
    <section
      aria-labelledby="contract-workspace-teams-heading"
      className="space-y-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="contract-workspace-teams-heading"
            className="type-section-title"
          >
            Roles and workspaces
          </h2>
          <p className="type-lead">
            Your company&apos;s people in each workspace of this contract. Each
            role opens one workspace only.
          </p>
        </div>
        {actions}
      </div>
      {enabled.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading workspaces…
        </p>
      ) : enabled.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getApiErrorMessage(enabled.error, "Unable to load workspaces.")}
          </AlertDescription>
        </Alert>
      ) : workspaces.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This contract has no workspaces enabled yet.
        </p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-3">
          {workspaceOptions
            .filter((option) => workspaces.includes(option))
            .map((option) => (
              <li key={option}>
                <WorkspaceTeamCard
                  companyId={companyId}
                  contractId={contractId}
                  workspace={option}
                  target={target}
                  busy={busy}
                  onAdd={() => onAdd(option)}
                  onToggleAdmin={(assignment) =>
                    onToggleAdmin(assignment, option)
                  }
                  onRevoke={(assignment) => onRevoke(assignment, option)}
                />
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

function WorkspaceTeamCard({
  companyId,
  contractId,
  workspace,
  target,
  busy,
  onAdd,
  onToggleAdmin,
  onRevoke,
}: {
  companyId: string;
  contractId: string;
  workspace: AssignableContractWorkspace;
  target?: ContractActivityTarget | null;
  busy: boolean;
  onAdd: () => void;
  onToggleAdmin: (assignment: ContractRoleAssignment) => void;
  onRevoke: (assignment: ContractRoleAssignment) => void;
}) {
  const label = formatLabel(workspace);
  const roleLabel = useContractRoleLabel();
  const permissionQuery = useGetContractRoleManagementPermissionsQuery({
    companyId,
    contractId,
    workspace,
  });
  const permissions = permissionQuery.data;
  const canManage = permissions?.canManage === true;
  const assignments = useGetContractRoleAssignmentsQuery(
    { companyId, contractId, workspace },
    { skip: !canManage },
  );
  const rows = assignments.data ?? [];
  const admins = rows.filter(({ isWorkspaceAdmin }) => isWorkspaceAdmin);

  return (
    <Card className="h-full gap-3">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          <h3 className="flex items-center gap-2 type-subsection-title">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${WORKSPACE_DOTS[workspace]}`}
            />
            {label} workspace
          </h3>
        </CardTitle>
        {canManage ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onAdd}
            aria-label={`Add a member to the ${label} workspace`}
          >
            Add
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {permissionQuery.isLoading || assignments.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading the {label} team…
          </p>
        ) : !canManage ? (
          <p className="text-sm text-muted-foreground">
            This workspace&apos;s team is managed by its Workspace Admin or a
            Company Administrator.
          </p>
        ) : assignments.error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {getApiErrorMessage(
                assignments.error,
                "Unable to load this workspace's team.",
              )}
            </AlertDescription>
          </Alert>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {label} is enabled, but nobody from your company is assigned yet.
          </p>
        ) : (
          <ul className="divide-y" aria-label={`${label} team`}>
            {rows.map((assignment) => (
              <li
                key={assignment.id}
                id={`activity-target-${assignment.id}`}
                className={`space-y-2 py-3 first:pt-0 last:pb-0 ${
                  target?.type === "contract_role_assignment" &&
                  target.id === assignment.id
                    ? "bg-primary/10"
                    : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 font-medium break-words">
                    {memberName(assignment)}
                    {assignment.isWorkspaceAdmin ? (
                      <Badge variant="info">Workspace Admin</Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {roleLabel(assignment.role)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {permissions?.canGrantWorkspaceAdmin ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => onToggleAdmin(assignment)}
                      aria-label={
                        assignment.isWorkspaceAdmin
                          ? `Remove Workspace Admin rights from ${memberName(assignment)}`
                          : `Make ${memberName(assignment)} Workspace Admin`
                      }
                    >
                      {assignment.isWorkspaceAdmin
                        ? "Remove admin"
                        : "Make admin"}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => onRevoke(assignment)}
                    aria-label={`Revoke ${roleLabel(assignment.role)} from ${memberName(assignment)}`}
                  >
                    Revoke
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {canManage && admins.length === 1 ? (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">
            {memberName(admins[0])} is the only {label} Workspace Admin. Make
            another member admin before removing them, so the workspace is never
            left without one.
          </p>
        ) : null}
        {canManage && rows.length > 0 && admins.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No Workspace Admin yet: only Company Administrators manage this
            team.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
