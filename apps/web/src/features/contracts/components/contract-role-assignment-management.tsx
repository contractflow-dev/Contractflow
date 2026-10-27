"use client";

import { useId, useState, type FormEvent } from "react";
import { EContractRole } from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
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
import { getApiErrorMessage } from "@/lib/apiError";
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
  const [feedback, setFeedback] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

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
    setFeedback(null);
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
      setFeedback("Contract role assigned.");
    } catch (error) {
      setFailure(
        getApiErrorMessage(error, "Unable to assign this contract role."),
      );
    }
  }

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    setFeedback(null);
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
      setInviteEmail("");
      setInviteAsWorkspaceAdmin(false);
      setFeedback("Contract role invitation sent.");
    } catch (error) {
      setFailure(
        getApiErrorMessage(error, "Unable to send this role invitation."),
      );
    }
  }

  async function changeWorkspaceAdmin(assignment: ContractRoleAssignment) {
    setFailure(null);
    setFeedback(null);
    try {
      await setWorkspaceAdmin({
        companyId,
        contractId,
        workspace,
        assignmentId: assignment.id,
        isWorkspaceAdmin: !assignment.isWorkspaceAdmin,
      }).unwrap();
      setFeedback(
        assignment.isWorkspaceAdmin
          ? `Removed workspace administrator privilege from ${memberName(assignment)}.`
          : `Granted workspace administrator privilege to ${memberName(assignment)}.`,
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

  async function revokePendingInvitation(invitationId: string) {
    setFailure(null);
    setFeedback(null);
    try {
      await revokeInvitation({
        companyId,
        contractId,
        workspace,
        invitationId,
      }).unwrap();
      setFeedback("Contract role invitation revoked.");
    } catch (error) {
      setFailure(
        getApiErrorMessage(error, "Unable to revoke this invitation."),
      );
    }
  }

  async function confirmRevocation() {
    if (!assignmentToRevoke) return;
    setFailure(null);
    setFeedback(null);
    try {
      await revokeRole({
        companyId,
        contractId,
        workspace,
        assignmentId: assignmentToRevoke.id,
      }).unwrap();
      setFeedback(
        `Revoked ${assignmentToRevoke.role} from ${memberName(assignmentToRevoke)}.`,
      );
      setAssignmentToRevoke(null);
    } catch (error) {
      setFailure(
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
          {feedback ? (
            <Alert role="status">
              <AlertDescription>{feedback}</AlertDescription>
            </Alert>
          ) : null}
          {failure ? (
            <Alert variant="destructive">
              <AlertDescription>{failure}</AlertDescription>
            </Alert>
          ) : null}

          <Field className="max-w-sm">
            <FieldLabel htmlFor={`${formId}-workspace`}>Workspace</FieldLabel>
            <NativeSelect
              id={`${formId}-workspace`}
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
                setFeedback(null);
              }}
            >
              {workspaceOptions.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {formatLabel(option)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <form
            onSubmit={(event) => void submitAssignment(event)}
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
          >
            <Field>
              <FieldLabel htmlFor={`${formId}-member`}>
                Company member
              </FieldLabel>
              <NativeSelect
                id={`${formId}-member`}
                className="w-full"
                required
                value={companyUserId}
                onChange={(event) => setCompanyUserId(event.target.value)}
                disabled={membersQuery.isFetching || !membersQuery.data?.length}
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
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-role`}>Contract role</FieldLabel>
              <NativeSelect
                id={`${formId}-role`}
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
            </Field>
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
                    <TableCell>
                      {new Date(assignment.assignedAt).toLocaleDateString()}
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
                          onClick={() => setAssignmentToRevoke(assignment)}
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
              <h3 className="font-medium">Invite to this workspace</h3>
              <p className="text-sm text-muted-foreground">
                The recipient must sign in with this email and be an active
                member of your company before accepting.
              </p>
            </div>
            <form
              onSubmit={(event) => void submitInvitation(event)}
              className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            >
              <Field>
                <FieldLabel htmlFor={`${formId}-invite-email`}>
                  Invitee email
                </FieldLabel>
                <Input
                  id={`${formId}-invite-email`}
                  type="email"
                  required
                  maxLength={320}
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </Field>
              <Button
                type="submit"
                disabled={invitationState.isLoading || !inviteEmail.trim()}
              >
                {invitationState.isLoading ? "Sending…" : "Send invitation"}
              </Button>
            </form>
            {permissions.canGrantWorkspaceAdmin ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={inviteAsWorkspaceAdmin}
                  onChange={(event) =>
                    setInviteAsWorkspaceAdmin(event.target.checked)
                  }
                />
                Invite as a workspace administrator
              </label>
            ) : null}
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
                {invitationsQuery.data.map((invitation) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                    key={invitation.id}
                  >
                    <span>
                      <span className="font-medium">{invitation.email}</span>
                      {" · "}
                      {invitation.role}
                      {invitation.isWorkspaceAdmin ? " · Workspace Admin" : ""}
                      {" · "}
                      <span className="capitalize">{invitation.status}</span>
                      {invitation.status === "pending"
                        ? ` · Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`
                        : ""}
                    </span>
                    {invitation.status === "pending" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={revokeInvitationState.isLoading}
                        onClick={() =>
                          void revokePendingInvitation(invitation.id)
                        }
                      >
                        Revoke invitation
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : !invitationsQuery.error ? (
              <p className="text-sm text-muted-foreground">
                No invitations have been sent for this workspace.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={assignmentToRevoke !== null}
        onOpenChange={(open) => {
          if (!open) setAssignmentToRevoke(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Revoke {assignmentToRevoke?.role}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {assignmentToRevoke
                ? `${memberName(assignmentToRevoke)} will lose access to this workspace.`
                : "This member will lose access to this workspace."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={revokeState.isLoading}
              onClick={() => void confirmRevocation()}
            >
              {revokeState.isLoading ? "Revoking…" : "Revoke role"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
