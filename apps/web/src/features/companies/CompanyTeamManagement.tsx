"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import {
  ECompanyRole,
  ECompanyUserStatus,
  EInvitationRole,
  EInvitationStatus,
} from "@contractflow/contracts-schema";
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
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@workspace/ui/components/empty";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";
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
  useInviteCompanyMemberMutation,
  useGetCompanyInvitationsQuery,
  useGetCompanyMembersQuery,
  useRemoveCompanyMemberMutation,
  useRevokeCompanyInvitationMutation,
  useChangeCompanyMemberRoleMutation,
} from "./companiesApi";
import type { CompanyMember } from "./companiesApi";

type StatusFilter = "active" | "inactive" | "all";

const memberName = (member: CompanyMember) =>
  `${member.firstName} ${member.lastName}`.trim() || member.email;

export function CompanyTeamManagement({ companyId }: { companyId: string }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, ECompanyRole>>(
    {},
  );
  const [memberToRemove, setMemberToRemove] = useState<CompanyMember | null>(
    null,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const {
    currentData: membersPage,
    error: membersError,
    isFetching: membersFetching,
  } = useGetCompanyMembersQuery({ companyId, limit: 100 });
  const {
    currentData: invitationsPage,
    error: invitationsError,
    isFetching: invitationsFetching,
  } = useGetCompanyInvitationsQuery({ companyId, limit: 100 });
  const members = membersPage?.items;
  const invitations = invitationsPage?.items;
  const [createInvitation, inviteState] = useInviteCompanyMemberMutation();
  const [updateMember, updateState] = useChangeCompanyMemberRoleMutation();
  const [removeMember, removeState] = useRemoveCompanyMemberMutation();
  const [revokeInvitation, revokeState] = useRevokeCompanyInvitationMutation();
  const formId = useId();

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (members ?? []).filter((member) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active"
          ? member.status === ECompanyUserStatus.ACTIVE
          : member.status !== ECompanyUserStatus.ACTIVE);
      const matchesSearch =
        !query ||
        `${memberName(member)} ${member.email} ${member.companyRole}`
          .toLowerCase()
          .includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [members, search, statusFilter]);

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setFailure(null);
    setFeedback(null);
    const formData = new FormData(event.currentTarget);
    const invitation = {
      email: String(formData.get("email") ?? "").trim(),
      companyRole: String(formData.get("companyRole")) as EInvitationRole,
    };
    try {
      await createInvitation({ companyId, data: invitation }).unwrap();
      form.reset();
      setFeedback("Invitation sent.");
    } catch (error) {
      setFailure(getApiErrorMessage(error, "Unable to send the invitation."));
    }
  }

  async function saveRole(member: CompanyMember) {
    const companyRole = roleDrafts[member.id];
    if (!companyRole || companyRole === member.companyRole) return;
    setFailure(null);
    setFeedback(null);
    try {
      await updateMember({
        companyId,
        membershipId: member.id,
        companyRole,
      }).unwrap();
      setRoleDrafts((current) => {
        const next = { ...current };
        delete next[member.id];
        return next;
      });
      setFeedback(`Updated access for ${memberName(member)}.`);
    } catch (error) {
      setFailure(getApiErrorMessage(error, "Unable to update this member."));
    }
  }

  async function confirmRemove() {
    if (!memberToRemove) return;
    setFailure(null);
    setFeedback(null);
    try {
      await removeMember({
        companyId,
        membershipId: memberToRemove.id,
      }).unwrap();
      setFeedback(
        `${memberName(memberToRemove)} no longer has company access.`,
      );
      setMemberToRemove(null);
    } catch (error) {
      setFailure(getApiErrorMessage(error, "Unable to remove this member."));
    }
  }

  async function revoke(invitationId: string) {
    setFailure(null);
    setFeedback(null);
    try {
      await revokeInvitation({ companyId, invitationId }).unwrap();
      setFeedback("Invitation revoked.");
    } catch (error) {
      setFailure(
        getApiErrorMessage(error, "Unable to revoke this invitation."),
      );
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-muted-foreground">
          Company administration
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Team management
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage company membership and invitations. Contract access remains
          separately assigned.
        </p>
      </header>

      {feedback && (
        <Alert role="status">
          <AlertDescription className="text-foreground">
            {feedback}
          </AlertDescription>
        </Alert>
      )}
      {failure && (
        <Alert variant="destructive">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle
            role="heading"
            aria-level={2}
            className="text-lg font-semibold"
          >
            Invite a team member
          </CardTitle>
          <CardDescription>
            The invitee must sign in and verify this email address to accept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => void submitInvitation(event)}
            className="grid gap-4 sm:grid-cols-2"
          >
            <InviteField
              id={`${formId}-email`}
              label="Email"
              name="email"
              type="email"
              required
            />
            <Field>
              <FieldLabel htmlFor={`${formId}-companyRole`}>
                Company role
              </FieldLabel>
              <NativeSelect
                id={`${formId}-companyRole`}
                name="companyRole"
                required
                defaultValue={EInvitationRole.CONTRACTOR_PROJECT_LEAD}
                className="w-full"
              >
                {Object.values(EInvitationRole).map((role) => (
                  <NativeSelectOption key={role} value={role}>
                    {role}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={inviteState.isLoading}>
                {inviteState.isLoading
                  ? "Sending invitation…"
                  : "Send invitation"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle
            role="heading"
            aria-level={2}
            className="text-lg font-semibold"
          >
            Company members
          </CardTitle>
          <CardDescription>
            Inactive records remain visible for membership history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldGroup className="gap-2 sm:flex-row">
            <Field>
              <FieldLabel className="sr-only" htmlFor="member-search">
                Search members
              </FieldLabel>
              <Input
                id="member-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search members"
              />
            </Field>
            <Field>
              <FieldLabel className="sr-only" htmlFor="member-status">
                Filter members by status
              </FieldLabel>
              <NativeSelect
                id="member-status"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="w-full"
              >
                <NativeSelectOption value="active">
                  Active members
                </NativeSelectOption>
                <NativeSelectOption value="inactive">
                  Inactive members
                </NativeSelectOption>
                <NativeSelectOption value="all">
                  All statuses
                </NativeSelectOption>
              </NativeSelect>
            </Field>
          </FieldGroup>
          {membersError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {getApiErrorMessage(
                  membersError,
                  "Unable to load team members.",
                )}
              </AlertDescription>
            </Alert>
          ) : membersFetching && !members ? (
            <div role="status" className="space-y-2">
              <span className="sr-only">Loading team members…</span>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyDescription>
                  {members?.length
                    ? "No members match these filters."
                    : "There are no company members to display."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Member</TableHead>
                  <TableHead scope="col">Role</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Joined</TableHead>
                  <TableHead scope="col">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => {
                  const selectedRole =
                    roleDrafts[member.id] ?? member.companyRole;
                  const active = member.status === ECompanyUserStatus.ACTIVE;
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <p className="font-medium">{memberName(member)}</p>
                        <p className="text-muted-foreground">{member.email}</p>
                      </TableCell>
                      <TableCell>
                        {active ? (
                          <div className="flex items-center gap-2">
                            <label
                              className="sr-only"
                              htmlFor={`role-${member.id}`}
                            >
                              Role for {memberName(member)}
                            </label>
                            <NativeSelect
                              id={`role-${member.id}`}
                              value={selectedRole}
                              onChange={(event) =>
                                setRoleDrafts((current) => ({
                                  ...current,
                                  [member.id]: event.target
                                    .value as ECompanyRole,
                                }))
                              }
                              className="max-w-56"
                            >
                              {Object.values(ECompanyRole).map((role) => (
                                <NativeSelectOption key={role} value={role}>
                                  {role}
                                </NativeSelectOption>
                              ))}
                            </NativeSelect>
                            {selectedRole !== member.companyRole && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={updateState.isLoading}
                                onClick={() => void saveRole(member)}
                              >
                                Save
                              </Button>
                            )}
                          </div>
                        ) : (
                          member.companyRole
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <time dateTime={member.joinedAt}>
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </time>
                        {member.leftAt && (
                          <p className="text-xs text-muted-foreground">
                            Left {new Date(member.leftAt).toLocaleDateString()}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {active && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setMemberToRemove(member)}
                          >
                            Remove
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle
            role="heading"
            aria-level={2}
            className="text-lg font-semibold"
          >
            Invitations
          </CardTitle>
          <CardDescription>
            Invitations expire after seven days and can be used only once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitationsError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {getApiErrorMessage(
                  invitationsError,
                  "Unable to load invitations.",
                )}
              </AlertDescription>
            </Alert>
          ) : invitationsFetching && !invitations ? (
            <div role="status" className="space-y-2">
              <span className="sr-only">Loading invitations…</span>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !invitations?.length ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyDescription>
                  No invitations have been sent.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul>
              {invitations.map((invitation, index) => (
                <li key={invitation.id}>
                  {index > 0 && <Separator />}
                  <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">
                        {invitation.firstName || invitation.lastName
                          ? `${[invitation.firstName, invitation.lastName]
                              .filter(Boolean)
                              .join(" ")} · `
                          : ""}
                        {invitation.email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {invitation.companyRole} · {invitation.status}
                        {invitation.status === EInvitationStatus.PENDING &&
                          ` · Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    {invitation.status === EInvitationStatus.PENDING && (
                      <Button
                        type="button"
                        variant="outline"
                        className="self-start sm:self-auto"
                        disabled={revokeState.isLoading}
                        onClick={() => void revoke(invitation.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={memberToRemove !== null}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {memberToRemove ? memberName(memberToRemove) : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This deactivates company membership while preserving the record.
              Contract-specific assignments are not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={removeState.isLoading}
              onClick={() => void confirmRemove()}
            >
              {removeState.isLoading ? "Removing…" : "Remove member"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InviteField({
  id,
  label,
  name,
  required = false,
  type = "text",
}: {
  id: string;
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} name={name} type={type} required={required} />
    </Field>
  );
}
