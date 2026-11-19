"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import type {
  ContractActivityTarget,
  ContractRole,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { FormField } from "@/components/forms/form-field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import {
  DataTable,
  DataTableEmpty,
  DataTableRowActions,
  type DataTableColumn,
} from "@/components/data-table/data-table";
import { DropdownMenuItem } from "@workspace/ui/components/dropdown-menu";
import {
  StatusBadge,
  effectiveInvitationStatus,
} from "@/components/status-badge/status-badge";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDate, humanizeEnumValue } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import {
  useAssignContractRoleMutation,
  useCreateContractRoleInvitationMutation,
  useGetContractRoleAssignmentMembersQuery,
  useGetContractRoleAssignmentsQuery,
  useGetContractRoleInvitationsQuery,
  useGetContractRoleManagementPermissionsQuery,
  useGetContractWorkspacesQuery,
  useRevokeContractRoleMutation,
  useRevokeContractRoleInvitationMutation,
  useSetContractWorkspaceAdminMutation,
  type AssignableContractWorkspace,
  type ContractRoleAssignment,
} from "@/services/contractApi";

const workspaceOptions: AssignableContractWorkspace[] = [
  "project",
  "hse",
  "finance",
];

/** A workspace's role assignments, with dates in the viewer's time zone. */
function assignmentColumns(
  timeZone: string | undefined,
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
          <p>{assignment.role}</p>
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

export function ContractRoleAssignmentManagement({
  companyId,
  contractId,
  fixedWorkspace,
  initialWorkspace,
  target,
}: {
  companyId: string;
  contractId: string;
  /** The workspace the assign and invite forms start on (from ?workspace=). */
  initialWorkspace?: AssignableContractWorkspace;
  /**
   * Manage only this workspace (inside a workspace's Team screen): the
   * workspace selector is hidden. The API checks access for it as always.
   */
  fixedWorkspace?: AssignableContractWorkspace;
  target?: ContractActivityTarget | null;
}) {
  const formId = useId();
  const [workspace, setWorkspace] = useState<AssignableContractWorkspace>(
    fixedWorkspace ?? initialWorkspace ?? "project",
  );
  // The workspace of the role being revoked: a workspace card may differ
  // from the one selected in the forms.
  const [revokeWorkspace, setRevokeWorkspace] =
    useState<AssignableContractWorkspace>(workspace);
  const formRef = useRef<HTMLFormElement>(null);
  const [companyUserId, setCompanyUserId] = useState("");
  // Empty until chosen: the first of the offered roles is used.
  const [role, setRole] = useState<ContractRole | "">("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteAsWorkspaceAdmin, setInviteAsWorkspaceAdmin] = useState(false);
  const [assignmentToRevoke, setAssignmentToRevoke] =
    useState<ContractRoleAssignment | null>(null);
  const [invitationToRevoke, setInvitationToRevoke] = useState<{
    id: string;
    email: string;
    role: string;
  } | null>(null);
  // Form and row-action failures are shown inline; confirmation failures
  // inside the open dialog.
  const [failure, setFailure] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState("");
  const timeZone = useUserTimeZone();

  const permissionQuery = useGetContractRoleManagementPermissionsQuery({
    companyId,
    contractId,
    workspace,
  });
  const permissions = permissionQuery.data;
  const canManage = permissions?.canManage === true;
  const canGrantWorkspaceAdmin = permissions?.canGrantWorkspaceAdmin === true;
  const membersQuery = useGetContractRoleAssignmentMembersQuery(
    { companyId, contractId, workspace },
    { skip: !canManage },
  );
  const assignmentsQuery = useGetContractRoleAssignmentsQuery(
    { companyId, contractId, workspace },
    { skip: !canManage },
  );
  const invitationsQuery = useGetContractRoleInvitationsQuery(
    { companyId, contractId, workspace },
    { skip: !canManage },
  );
  const [assignRole, assignState] = useAssignContractRoleMutation();
  const [revokeRole, revokeState] = useRevokeContractRoleMutation();
  const [setWorkspaceAdmin, workspaceAdminState] =
    useSetContractWorkspaceAdminMutation();
  const [createInvitation, invitationState] =
    useCreateContractRoleInvitationMutation();
  const [revokeInvitation, revokeInvitationState] =
    useRevokeContractRoleInvitationMutation();
  // The API offers only the roles of this company's side of the contract:
  // client roles for the client, contractor roles for every other party.
  const roles = permissions?.roles ?? [];
  const selectedRole: ContractRole | undefined =
    role && roles.includes(role) ? role : roles[0];
  const sideLabel =
    permissions?.roleSide === "client" ? "client" : "contractor";

  // Without a fixed workspace, every enabled workspace is shown side by side
  // (prototype D5); the forms below act on the selected one.
  const workspaceCards = fixedWorkspace ? null : (
    <ContractWorkspaceTeams
      companyId={companyId}
      contractId={contractId}
      target={target}
      busy={workspaceAdminState.isLoading || revokeState.isLoading}
      onAdd={(next) => {
        setWorkspace(next);
        setRole("");
        setFailure(null);
        formRef.current?.scrollIntoView({ block: "center" });
        formRef.current?.querySelector("select")?.focus();
      }}
      onToggleAdmin={(assignment, next) =>
        void changeWorkspaceAdmin(assignment, next)
      }
      onRevoke={(assignment, next) => {
        setDialogError("");
        setRevokeWorkspace(next);
        setAssignmentToRevoke(assignment);
      }}
    />
  );

  if (permissionQuery.isLoading) return workspaceCards;
  if (permissionQuery.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {getApiErrorMessage(
            permissionQuery.error,
            "Unable to verify contract role management access.",
          )}
        </AlertDescription>
      </Alert>
    );
  }
  if (!canManage || !permissions) {
    return workspaceCards ? (
      <>
        {workspaceCards}
        {revocationDialog()}
      </>
    ) : null;
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    if (!selectedRole) return;
    try {
      await assignRole({
        companyId,
        contractId,
        workspace,
        companyUserId,
        role: selectedRole,
        isWorkspaceAdmin: false,
      }).unwrap();
      setCompanyUserId("");
      notifySuccess("Contract role assigned", `${selectedRole} was assigned.`);
    } catch (error) {
      setFailure(
        getApiErrorMessage(error, "Unable to assign this contract role."),
      );
    }
  }

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    if (!selectedRole) return;
    try {
      await createInvitation({
        companyId,
        contractId,
        workspace,
        email: inviteEmail.trim(),
        role: selectedRole,
        isWorkspaceAdmin: inviteAsWorkspaceAdmin && canGrantWorkspaceAdmin,
      }).unwrap();
      notifySuccess(
        "Role invitation sent",
        `${inviteEmail.trim()} was invited as ${selectedRole}.`,
      );
      setInviteEmail("");
      setInviteAsWorkspaceAdmin(false);
    } catch (error) {
      setFailure(
        getApiErrorMessage(error, "Unable to send this role invitation."),
      );
    }
  }

  async function changeWorkspaceAdmin(
    assignment: ContractRoleAssignment,
    assignmentWorkspace: AssignableContractWorkspace = workspace,
  ) {
    setFailure(null);
    try {
      await setWorkspaceAdmin({
        companyId,
        contractId,
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

  async function confirmInvitationRevocation() {
    if (!invitationToRevoke || revokeInvitationState.isLoading) return;
    setDialogError("");
    try {
      await revokeInvitation({
        companyId,
        contractId,
        workspace,
        invitationId: invitationToRevoke.id,
      }).unwrap();
      notifySuccess(
        "Role invitation revoked",
        `The invitation for ${invitationToRevoke.email} no longer works.`,
      );
      setInvitationToRevoke(null);
    } catch (error) {
      setDialogError(
        getApiErrorMessage(error, "Unable to revoke this invitation."),
      );
    }
  }

  async function confirmRevocation() {
    if (!assignmentToRevoke || revokeState.isLoading) return;
    setDialogError("");
    try {
      await revokeRole({
        companyId,
        contractId,
        workspace: revokeWorkspace,
        assignmentId: assignmentToRevoke.id,
      }).unwrap();
      notifySuccess(
        "Contract role revoked",
        `${memberName(assignmentToRevoke)} no longer has ${assignmentToRevoke.role}.`,
      );
      setAssignmentToRevoke(null);
    } catch (error) {
      setDialogError(
        getApiErrorMessage(error, "Unable to revoke this contract role."),
      );
    }
  }

  function revocationDialog() {
    return (
      <ConfirmDialog
        open={assignmentToRevoke !== null}
        title={
          assignmentToRevoke
            ? `Revoke ${assignmentToRevoke.role}?`
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
    );
  }

  return (
    <>
      {workspaceCards}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>
              {fixedWorkspace
                ? "Contract role assignments"
                : "Assign or invite"}
            </h2>
          </CardTitle>
          <CardDescription>
            Manage active roles for members of your company. Contract access
            ends when an assignment is revoked. Your company is on the{" "}
            {sideLabel} side of this contract, so only {sideLabel} roles are
            offered.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {failure ? (
            <Alert variant="destructive">
              <AlertDescription>{failure}</AlertDescription>
            </Alert>
          ) : null}

          {fixedWorkspace ? null : (
            <FormField
              id={`${formId}-workspace`}
              label="Workspace"
              description="Role assignments and invitations below apply to this workspace."
              className="max-w-sm"
            >
              {(control) => (
                <NativeSelect
                  {...control}
                  className="w-full"
                  value={workspace}
                  onChange={(event) => {
                    const nextWorkspace = workspaceOptions.find(
                      (option) => option === event.target.value,
                    );
                    if (!nextWorkspace) return;
                    setWorkspace(nextWorkspace);
                    setRole("");
                    setFailure(null);
                  }}
                >
                  {workspaceOptions.map((option) => (
                    <NativeSelectOption key={option} value={option}>
                      {formatLabel(option)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          )}

          <form
            ref={formRef}
            onSubmit={(event) => void submitAssignment(event)}
            aria-label="Assign a contract role"
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
          >
            <FormField id={`${formId}-member`} label="Company member">
              {(control) => (
                <NativeSelect
                  {...control}
                  className="w-full"
                  required
                  value={companyUserId}
                  onChange={(event) => setCompanyUserId(event.target.value)}
                  disabled={
                    membersQuery.isFetching || !membersQuery.data?.length
                  }
                >
                  <NativeSelectOption value="">
                    Select a member
                  </NativeSelectOption>
                  {membersQuery.data?.map((member) => (
                    <NativeSelectOption key={member.id} value={member.id}>
                      {`${member.firstName} ${member.lastName}`.trim() ||
                        member.email}
                      {" · "}
                      {member.email}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id={`${formId}-role`} label="Contract role">
              {(control) => (
                <NativeSelect
                  {...control}
                  className="w-full"
                  value={selectedRole}
                  onChange={(event) => {
                    const nextRole = roles.find(
                      (option) => option === event.target.value,
                    );
                    if (nextRole) setRole(nextRole);
                  }}
                >
                  {roles.map((option) => (
                    <NativeSelectOption key={option} value={option}>
                      {option}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <Button
              type="submit"
              disabled={
                assignState.isLoading ||
                !companyUserId ||
                !selectedRole ||
                membersQuery.isFetching ||
                !membersQuery.data?.length
              }
            >
              {assignState.isLoading ? "Assigning…" : "Assign role"}
            </Button>
          </form>

          {membersQuery.error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {getApiErrorMessage(
                  membersQuery.error,
                  "Unable to load eligible company members.",
                )}
              </AlertDescription>
            </Alert>
          ) : null}
          {!membersQuery.error &&
          membersQuery.data &&
          membersQuery.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active company members are available to assign.
            </p>
          ) : null}
          {fixedWorkspace ? (
            // Narrow enough for phones once the actions sit in a menu, so one
            // table serves every width and deep links keep a single target.
            <DataTable
              label="Role assignments"
              columns={assignmentColumns(timeZone)}
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
                  label={`Actions for ${memberName(assignment)}, ${assignment.role}`}
                >
                  {permissions.canGrantWorkspaceAdmin ? (
                    <DropdownMenuItem
                      disabled={workspaceAdminState.isLoading}
                      onClick={() =>
                        void changeWorkspaceAdmin(assignment, workspace)
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
                      setRevokeWorkspace(workspace);
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
          ) : null}

          <div className="space-y-4 border-t pt-5">
            <div>
              <h3 className="type-subsection-title">
                Invite to this workspace
              </h3>
              <p className="text-sm text-muted-foreground">
                The recipient must sign in with this email and be an active
                member of your company before accepting. The invitation is for
                the contract role selected above:{" "}
                <span className="font-medium text-foreground">
                  {selectedRole}
                </span>
                .
              </p>
            </div>
            <form
              onSubmit={(event) => void submitInvitation(event)}
              aria-label="Invite to this workspace"
              className="space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <FormField id={`${formId}-invite-email`} label="Invitee email">
                  {(control) => (
                    <Input
                      {...control}
                      type="email"
                      autoComplete="off"
                      required
                      maxLength={320}
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                    />
                  )}
                </FormField>
                <Button
                  type="submit"
                  disabled={
                    invitationState.isLoading ||
                    !inviteEmail.trim() ||
                    !selectedRole
                  }
                  aria-busy={invitationState.isLoading || undefined}
                >
                  {invitationState.isLoading ? "Sending…" : "Send invitation"}
                </Button>
              </div>
              {permissions.canGrantWorkspaceAdmin ? (
                <Field orientation="horizontal" className="w-fit">
                  <Checkbox
                    id={`${formId}-workspace-admin`}
                    checked={inviteAsWorkspaceAdmin}
                    onCheckedChange={setInviteAsWorkspaceAdmin}
                  />
                  <FieldLabel
                    htmlFor={`${formId}-workspace-admin`}
                    className="font-normal"
                  >
                    Invite as a workspace administrator
                  </FieldLabel>
                </Field>
              ) : null}
            </form>
            {invitationsQuery.error ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {getApiErrorMessage(
                    invitationsQuery.error,
                    "Unable to load contract role invitations.",
                  )}
                </AlertDescription>
              </Alert>
            ) : null}
            {invitationsQuery.isLoading ? (
              <p role="status" className="text-sm text-muted-foreground">
                Loading invitations…
              </p>
            ) : invitationsQuery.data?.length ? (
              <ul className="divide-y">
                {invitationsQuery.data.map((invitation) => {
                  const status = effectiveInvitationStatus(
                    invitation.status,
                    invitation.expiresAt,
                  );
                  return (
                    <li
                      id={`activity-target-${invitation.id}`}
                      className={`flex flex-wrap items-center justify-between gap-3 py-3 text-sm ${
                        target?.type === "contract_role_invitation" &&
                        target.id === invitation.id
                          ? "bg-primary/10"
                          : ""
                      }`}
                      key={invitation.id}
                    >
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium break-all">
                          {invitation.email}
                        </span>
                        <span className="text-muted-foreground">
                          {invitation.role}
                          {invitation.isWorkspaceAdmin
                            ? " · Workspace Admin"
                            : ""}
                        </span>
                        <StatusBadge status={status} />
                        {status === "pending" ? (
                          <span className="text-xs text-muted-foreground">
                            Expires{" "}
                            {formatDate(invitation.expiresAt, { timeZone })}
                          </span>
                        ) : null}
                      </span>
                      {status === "pending" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={revokeInvitationState.isLoading}
                          onClick={() => {
                            setDialogError("");
                            setInvitationToRevoke({
                              id: invitation.id,
                              email: invitation.email,
                              role: invitation.role,
                            });
                          }}
                        >
                          Revoke invitation
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : !invitationsQuery.error ? (
              <p className="text-sm text-muted-foreground">
                No invitations have been sent for this workspace.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {revocationDialog()}

      <ConfirmDialog
        open={invitationToRevoke !== null}
        title="Revoke this role invitation?"
        description={
          invitationToRevoke
            ? `The invitation for ${invitationToRevoke.email} to join as ${invitationToRevoke.role} will stop working. You can send a new invitation later.`
            : ""
        }
        confirmLabel="Revoke invitation"
        pendingLabel="Revoking…"
        isPending={revokeInvitationState.isLoading}
        error={invitationToRevoke ? dialogError : undefined}
        destructive
        onConfirm={() => void confirmInvitationRevocation()}
        onCancel={() => setInvitationToRevoke(null)}
      />
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
  onAdd,
  onToggleAdmin,
  onRevoke,
}: {
  companyId: string;
  contractId: string;
  target?: ContractActivityTarget | null;
  busy: boolean;
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
      <div>
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
                    {assignment.role}
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
                    aria-label={`Revoke ${assignment.role} from ${memberName(assignment)}`}
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
