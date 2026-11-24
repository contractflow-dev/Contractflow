"use client";

import { useId, useState, type FormEvent } from "react";
import type {
  ContractActivityTarget,
  ContractRole,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import { FormField } from "@/components/forms/form-field";
import {
  StatusBadge,
  effectiveInvitationStatus,
} from "@/components/status-badge/status-badge";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage } from "@/lib/apiError";
import { emailFieldError } from "@/lib/email-field";
import { formatDate, humanizeEnumValue } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
  useAssignContractRoleMutation,
  useCreateContractRoleInvitationMutation,
  useGetContractRoleAssignmentMembersQuery,
  useGetContractRoleInvitationsQuery,
  useGetContractRoleManagementPermissionsQuery,
  useRevokeContractRoleInvitationMutation,
  type AssignableContractWorkspace,
} from "@/services/contractApi";

interface ContractScope {
  companyId: string;
  contractId: string;
  /** The workspaces this viewer may manage; the API checks again. */
  workspaces: readonly AssignableContractWorkspace[];
  /** The workspace to open on. */
  initialWorkspace: AssignableContractWorkspace;
}

/** The workspace picker, shown only when there's more than one to choose. */
function WorkspaceField({
  id,
  workspaces,
  value,
  onChange,
}: {
  id: string;
  workspaces: readonly AssignableContractWorkspace[];
  value: AssignableContractWorkspace;
  onChange: (workspace: AssignableContractWorkspace) => void;
}) {
  if (workspaces.length < 2) return null;
  return (
    <FormField id={id} label="Workspace">
      {(control) => (
        <NativeSelect
          {...control}
          className="w-full"
          value={value}
          onChange={(event) => {
            const next = workspaces.find(
              (option) => option === event.target.value,
            );
            if (next) onChange(next);
          }}
        >
          {workspaces.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {humanizeEnumValue(option)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
    </FormField>
  );
}

function RoleField({
  id,
  roles,
  value,
  onChange,
}: {
  id: string;
  roles: readonly ContractRole[];
  value: ContractRole | undefined;
  onChange: (role: ContractRole) => void;
}) {
  return (
    <FormField id={id} label="Contract role">
      {(control) => (
        <NativeSelect
          {...control}
          className="w-full"
          value={value}
          disabled={!roles.length}
          onChange={(event) => {
            const next = roles.find((option) => option === event.target.value);
            if (next) onChange(next);
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
  );
}

/** Gives an existing company member a role in one workspace of the contract. */
export function AssignMemberDialog({
  open,
  onOpenChange,
  ...scope
}: ContractScope & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* Remounted on every open, so it always starts empty. */}
        {open ? (
          <AssignMemberForm {...scope} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AssignMemberForm({
  companyId,
  contractId,
  workspaces,
  initialWorkspace,
  onDone,
}: ContractScope & { onDone: () => void }) {
  const formId = useId();
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [companyUserId, setCompanyUserId] = useState("");
  // Empty until chosen: the first of the offered roles is used.
  const [role, setRole] = useState<ContractRole | "">("");
  const [memberError, setMemberError] = useState<string>();
  const [failure, setFailure] = useState("");
  const query = { companyId, contractId, workspace };
  const permissions = useGetContractRoleManagementPermissionsQuery(query);
  const canManage = permissions.data?.canManage === true;
  const members = useGetContractRoleAssignmentMembersQuery(query, {
    skip: !canManage,
  });
  const [assignRole, assignState] = useAssignContractRoleMutation();
  // The API offers only the roles of this company's side of the contract.
  const roles = permissions.data?.roles ?? [];
  const selectedRole = role && roles.includes(role) ? role : roles[0];
  const side =
    permissions.data?.roleSide === "client" ? "client" : "contractor";
  const noMembers = !members.error && members.data?.length === 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (assignState.isLoading || !selectedRole) return;
    setFailure("");
    if (!companyUserId) {
      setMemberError("Select a company member.");
      return;
    }
    try {
      await assignRole({
        ...query,
        companyUserId,
        role: selectedRole,
        isWorkspaceAdmin: false,
      }).unwrap();
      notifySuccess("Contract role assigned", `${selectedRole} was assigned.`);
      onDone();
    } catch (error) {
      setFailure(
        getApiErrorMessage(error, "Unable to assign this contract role."),
      );
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      aria-label="Assign a contract role"
      className="space-y-5"
    >
      <DialogHeader className="pe-8">
        <DialogTitle>Assign member</DialogTitle>
        <DialogDescription>
          Give a member of your company a role in the{" "}
          {humanizeEnumValue(workspace)} workspace. Your company is on the{" "}
          {side} side of this contract, so only {side} roles are offered.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <WorkspaceField
          id={`${formId}-workspace`}
          workspaces={workspaces}
          value={workspace}
          onChange={(next) => {
            setWorkspace(next);
            setRole("");
            setCompanyUserId("");
            setMemberError(undefined);
            setFailure("");
          }}
        />
        <FormField
          id={`${formId}-member`}
          label="Company member"
          required
          error={memberError}
        >
          {(control) => (
            <NativeSelect
              {...control}
              className="w-full"
              value={companyUserId}
              disabled={members.isFetching || !members.data?.length}
              onChange={(event) => {
                setCompanyUserId(event.target.value);
                setMemberError(undefined);
              }}
            >
              <NativeSelectOption value="">Select a member</NativeSelectOption>
              {members.data?.map((member) => (
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
        <RoleField
          id={`${formId}-role`}
          roles={roles}
          value={selectedRole}
          onChange={setRole}
        />
        {noMembers ? (
          <p className="text-sm text-muted-foreground">
            No active company members are available to assign.
          </p>
        ) : null}
      </div>

      {members.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getApiErrorMessage(
              members.error,
              "Unable to load eligible company members.",
            )}
          </AlertDescription>
        </Alert>
      ) : null}
      {failure ? (
        <Alert variant="destructive">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            assignState.isLoading ||
            !selectedRole ||
            members.isFetching ||
            !members.data?.length
          }
          aria-busy={assignState.isLoading || undefined}
        >
          {assignState.isLoading ? "Assigning…" : "Assign Member"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * The contract's role invitations for one workspace, and sending a new one.
 * A recipient accepts or rejects from their own invitation link, so the only
 * action here is revoking a pending invitation.
 */
export function ContractRoleInvitationsSheet({
  open,
  onOpenChange,
  contractLabel,
  target,
  ...scope
}: ContractScope & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Reference and title, naming the contract in the heading. */
  contractLabel?: string;
  target?: ContractActivityTarget | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        {open ? (
          <RoleInvitationsPanel
            {...scope}
            contractLabel={contractLabel}
            target={target}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function RoleInvitationsPanel({
  companyId,
  contractId,
  workspaces,
  initialWorkspace,
  contractLabel,
  target,
}: ContractScope & {
  contractLabel?: string;
  target?: ContractActivityTarget | null;
}) {
  const formId = useId();
  const timeZone = useUserTimeZone();
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [role, setRole] = useState<ContractRole | "">("");
  const [asAdmin, setAsAdmin] = useState(false);
  const [failure, setFailure] = useState("");
  // Revoking is confirmed in its row, so no dialog opens over this panel.
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeFailure, setRevokeFailure] = useState("");
  const query = { companyId, contractId, workspace };
  const permissions = useGetContractRoleManagementPermissionsQuery(query);
  const canManage = permissions.data?.canManage === true;
  const canGrantAdmin = permissions.data?.canGrantWorkspaceAdmin === true;
  const invitations = useGetContractRoleInvitationsQuery(query, {
    skip: !canManage,
  });
  const [createInvitation, createState] =
    useCreateContractRoleInvitationMutation();
  const [revokeInvitation, revokeState] =
    useRevokeContractRoleInvitationMutation();
  const roles = permissions.data?.roles ?? [];
  const selectedRole = role && roles.includes(role) ? role : roles[0];

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createState.isLoading || !selectedRole) return;
    setFailure("");
    const invalid = emailFieldError(email);
    setEmailError(invalid);
    if (invalid) return;
    try {
      await createInvitation({
        ...query,
        email: email.trim(),
        role: selectedRole,
        isWorkspaceAdmin: asAdmin && canGrantAdmin,
      }).unwrap();
      notifySuccess(
        "Role invitation sent",
        `${email.trim()} was invited as ${selectedRole}.`,
      );
      setEmail("");
      setAsAdmin(false);
    } catch (error) {
      setFailure(
        getApiErrorMessage(error, "Unable to send this role invitation."),
      );
    }
  }

  async function revoke(id: string, invitee: string) {
    if (revokeState.isLoading) return;
    setRevokeFailure("");
    try {
      await revokeInvitation({ ...query, invitationId: id }).unwrap();
      notifySuccess(
        "Role invitation revoked",
        `The invitation for ${invitee} no longer works.`,
      );
      setRevoking(null);
    } catch (error) {
      setRevokeFailure(
        getApiErrorMessage(error, "Unable to revoke this invitation."),
      );
    }
  }

  return (
    <>
      <SheetHeader className="border-b pe-14">
        <SheetTitle>Contract Role Invitations</SheetTitle>
        <SheetDescription>
          {contractLabel ? `${contractLabel}. ` : ""}Invite an active member of
          your company to a contract role. They sign in with this email to
          accept.
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 p-6">
        <WorkspaceField
          id={`${formId}-workspace`}
          workspaces={workspaces}
          value={workspace}
          onChange={(next) => {
            setWorkspace(next);
            setRole("");
            setFailure("");
            setRevoking(null);
            setRevokeFailure("");
          }}
        />

        <form
          noValidate
          onSubmit={(event) => void send(event)}
          aria-label="Invite to this workspace"
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id={`${formId}-email`}
              label="Invitee email"
              required
              error={emailError}
            >
              {(control) => (
                <Input
                  {...control}
                  type="email"
                  autoComplete="off"
                  maxLength={320}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setEmailError(undefined);
                  }}
                />
              )}
            </FormField>
            <RoleField
              id={`${formId}-role`}
              roles={roles}
              value={selectedRole}
              onChange={setRole}
            />
          </div>
          {canGrantAdmin ? (
            <Field orientation="horizontal" className="w-fit">
              <Checkbox
                id={`${formId}-admin`}
                checked={asAdmin}
                onCheckedChange={(checked) => setAsAdmin(checked === true)}
              />
              <FieldLabel htmlFor={`${formId}-admin`} className="font-normal">
                Invite as a workspace administrator
              </FieldLabel>
            </Field>
          ) : null}
          {failure ? (
            <Alert variant="destructive">
              <AlertDescription>{failure}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="submit"
            disabled={createState.isLoading || !selectedRole}
            aria-busy={createState.isLoading || undefined}
          >
            {createState.isLoading ? "Sending…" : "Send Invitation"}
          </Button>
        </form>

        <section aria-labelledby={`${formId}-list`} className="border-t pt-5">
          <h3 id={`${formId}-list`} className="type-subsection-title">
            {humanizeEnumValue(workspace)} invitations
          </h3>
          {invitations.error ? (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {getApiErrorMessage(
                    invitations.error,
                    "Unable to load contract role invitations.",
                  )}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void invitations.refetch()}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : invitations.isLoading || permissions.isLoading ? (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              Loading invitations…
            </p>
          ) : invitations.data?.length ? (
            <ul className="mt-2 divide-y">
              {invitations.data.map((invitation) => {
                const status = effectiveInvitationStatus(
                  invitation.status,
                  invitation.expiresAt,
                );
                const confirming = revoking === invitation.id;
                return (
                  <li
                    key={invitation.id}
                    id={`activity-target-${invitation.id}`}
                    className={cn(
                      "space-y-2 py-3",
                      target?.type === "contract_role_invitation" &&
                        target.id === invitation.id &&
                        "bg-primary/10",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium break-all">
                          {invitation.email}
                        </p>
                        <p className="text-muted-foreground">
                          {invitation.role}
                          {invitation.isWorkspaceAdmin
                            ? " · Workspace Admin"
                            : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Invited{" "}
                          {formatDate(invitation.createdAt, { timeZone })}
                          {status === "pending"
                            ? ` · Expires ${formatDate(invitation.expiresAt, { timeZone })}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge status={status} />
                    </div>
                    {status === "pending" && !confirming ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Revoke invitation for ${invitation.email}`}
                        onClick={() => {
                          setRevokeFailure("");
                          setRevoking(invitation.id);
                        }}
                      >
                        Revoke invitation
                      </Button>
                    ) : null}
                    {status === "pending" && confirming ? (
                      <div className="space-y-2 rounded-xl border p-3">
                        <p>
                          The invitation for {invitation.email} to join as{" "}
                          {invitation.role} will stop working. You can send a
                          new invitation later.
                        </p>
                        {revokeFailure ? (
                          <p role="alert" className="text-destructive">
                            {revokeFailure}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={revokeState.isLoading}
                            aria-busy={revokeState.isLoading || undefined}
                            onClick={() =>
                              void revoke(invitation.id, invitation.email)
                            }
                          >
                            {revokeState.isLoading
                              ? "Revoking…"
                              : "Confirm revoke"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={revokeState.isLoading}
                            onClick={() => setRevoking(null)}
                          >
                            Keep invitation
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No invitations have been sent for this workspace.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
