"use client";

import { useId, useState, type FormEvent } from "react";
import { EContractRole } from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
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
  useRevokeContractRoleMutation,
  useRevokeContractRoleInvitationMutation,
  useSetContractWorkspaceAdminMutation,
  type AssignableContractWorkspace,
  type ContractRoleAssignment,
} from "@/services/contractApi";

const roleOptions: Record<AssignableContractWorkspace, EContractRole[]> = {
  project: [
    EContractRole.CONTRACTOR_PROJECT_LEAD,
    EContractRole.CONTRACTOR_SITE_SUPERVISOR,
    EContractRole.CLIENT_PROJECT_MANAGER,
    EContractRole.CLIENT_SITE_ENGINEER,
  ],
  hse: [EContractRole.HSE_OFFICER, EContractRole.HSE_MANAGER],
  finance: [EContractRole.FINANCE_OFFICER, EContractRole.FINANCE_DIRECTOR],
};

const workspaceOptions: AssignableContractWorkspace[] = [
  "project",
  "hse",
  "finance",
];

const memberName = (assignment: ContractRoleAssignment) =>
  `${assignment.firstName} ${assignment.lastName}`.trim() || assignment.email;

export function ContractRoleAssignmentManagement({
  companyId,
  contractId,
}: {
  companyId: string;
  contractId: string;
}) {
  const formId = useId();
  const [workspace, setWorkspace] =
    useState<AssignableContractWorkspace>("project");
  const [companyUserId, setCompanyUserId] = useState("");
  const [role, setRole] = useState<EContractRole>(roleOptions.project[0]);
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
  const canGrantWorkspaceAdmin =
    permissions?.canGrantWorkspaceAdmin === true;
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
  const roles = roleOptions[workspace];
  const selectedRole = roles.includes(role) ? role : roles[0];

  if (permissionQuery.isLoading) return null;
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
  if (!canManage || !permissions) return null;

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
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
    try {
      await createInvitation({
        companyId,
        contractId,
        workspace,
        email: inviteEmail.trim(),
        role: selectedRole,
        isWorkspaceAdmin:
          inviteAsWorkspaceAdmin && canGrantWorkspaceAdmin,
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

  async function changeWorkspaceAdmin(assignment: ContractRoleAssignment) {
    setFailure(null);
    try {
      await setWorkspaceAdmin({
        companyId,
        contractId,
        workspace,
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
        workspace,
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Contract role assignments</CardTitle>
          <CardDescription>
            Manage active roles for members of your company. Contract access
            ends when an assignment is revoked.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {failure ? (
            <Alert variant="destructive">
              <AlertDescription>{failure}</AlertDescription>
            </Alert>
          ) : null}

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
                  setRole(roleOptions[nextWorkspace][0]);
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

          <form
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
          {assignmentsQuery.error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {getApiErrorMessage(
                  assignmentsQuery.error,
                  "Unable to load contract role assignments.",
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          {assignmentsQuery.isLoading ? (
            <p role="status" className="py-4 text-sm text-muted-foreground">
              Loading role assignments…
            </p>
          ) : assignmentsQuery.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignmentsQuery.data.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <p className="font-medium">{memberName(assignment)}</p>
                      <p className="text-sm text-muted-foreground">
                        {assignment.email}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p>{assignment.role}</p>
                      {assignment.isWorkspaceAdmin ? (
                        <p className="text-xs font-medium text-primary">
                          Workspace Admin
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(assignment.assignedAt, { timeZone })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {permissions.canGrantWorkspaceAdmin ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={workspaceAdminState.isLoading}
                            onClick={() =>
                              void changeWorkspaceAdmin(assignment)
                            }
                          >
                            {assignment.isWorkspaceAdmin
                              ? "Remove admin"
                              : "Make workspace admin"}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={revokeState.isLoading}
                          onClick={() => {
                            setDialogError("");
                            setAssignmentToRevoke(assignment);
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : !assignmentsQuery.error ? (
            <p className="py-4 text-sm text-muted-foreground">
              No active roles are assigned in this workspace.
            </p>
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
                  disabled={invitationState.isLoading || !inviteEmail.trim()}
                  aria-busy={invitationState.isLoading || undefined}
                >
                  {invitationState.isLoading ? "Sending…" : "Send invitation"}
                </Button>
              </div>
              {permissions.canGrantWorkspaceAdmin ? (
                <label className="flex min-h-6 w-fit items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={inviteAsWorkspaceAdmin}
                    onChange={(event) =>
                      setInviteAsWorkspaceAdmin(event.target.checked)
                    }
                  />
                  Invite as a workspace administrator
                </label>
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
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
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

      <ConfirmDialog
        open={assignmentToRevoke !== null}
        title={
          assignmentToRevoke
            ? `Revoke ${assignmentToRevoke.role}?`
            : "Revoke this contract role?"
        }
        description={
          assignmentToRevoke
            ? `${memberName(assignmentToRevoke)} will lose access to the ${humanizeEnumValue(workspace)} workspace of this contract. You can assign the role again later.`
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
