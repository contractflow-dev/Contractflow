"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  ECompanyRole,
  ECompanyUserStatus,
  EInvitationRole,
  EInvitationStatus,
} from "@contractflow/contracts-schema";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
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
import {
  useChangeCompanyMemberRoleMutation,
  useGetCompanyInvitationsQuery,
  useGetCompanyMembersQuery,
  useInviteCompanyMemberMutation,
  useRemoveCompanyMemberMutation,
  useRevokeCompanyInvitationMutation,
} from "@/features/companies";
import type { CompanyMember } from "@/features/companies";
import { getApiErrorMessage } from "@/lib/apiError";
import { CompanyAdminWorkspace } from "../../company-dashboard/_views/company-admin-workspace";

const invitationRoles = Object.values(EInvitationRole);
const memberRoles = Object.values(ECompanyRole);

export function CompanyTeamView({
  initialCompanyId,
}: {
  initialCompanyId: string;
}) {
  return (
    <CompanyAdminWorkspace
      companyId={initialCompanyId}
      activePath="/dashboards/team"
    >
      {(companyId) => <TeamContent companyId={companyId} />}
    </CompanyAdminWorkspace>
  );
}

function TeamContent({ companyId }: { companyId: string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ECompanyUserStatus | "">("");
  const [page, setPage] = useState(1);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyMemberId, setBusyMemberId] = useState("");
  const [busyInvitationId, setBusyInvitationId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<EInvitationRole>(
    EInvitationRole.CONTRACTOR_PROJECT_LEAD,
  );
  const {
    currentData: members,
    error: membersError,
    isLoading: membersLoading,
  } = useGetCompanyMembersQuery({
    companyId,
    page,
    limit: 20,
    search: search.trim() || undefined,
    status: status || undefined,
  });
  const {
    currentData: invitations,
    error: invitationsError,
    isLoading: invitationsLoading,
  } = useGetCompanyInvitationsQuery({ companyId, page: 1, limit: 50 });
  const [inviteMember, inviteState] = useInviteCompanyMemberMutation();
  const [changeRole] = useChangeCompanyMemberRoleMutation();
  const [removeMember] = useRemoveCompanyMemberMutation();
  const [revokeInvitation] = useRevokeCompanyInvitationMutation();

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteError("");
    setInviteSuccess("");
    try {
      await inviteMember({
        companyId,
        data: {
          email,
          firstName,
          lastName,
          companyRole: role,
        },
      }).unwrap();
      setInviteSuccess(`Invitation sent to ${email.trim()}.`);
      setEmail("");
      setFirstName("");
      setLastName("");
    } catch (error) {
      setInviteError(
        getApiErrorMessage(error, "The invitation could not be sent."),
      );
    }
  }

  async function updateRole(member: CompanyMember, value: string) {
    if (!memberRoles.includes(value as ECompanyRole)) return;
    setActionError("");
    setBusyMemberId(member.id);
    try {
      await changeRole({
        companyId,
        membershipId: member.id,
        companyRole: value as ECompanyRole,
      }).unwrap();
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, "The member role could not be changed."),
      );
    } finally {
      setBusyMemberId("");
    }
  }

  async function remove(member: CompanyMember) {
    if (
      !window.confirm(
        `Remove ${member.firstName} ${member.lastName} from this company? Their user account will not be deleted.`,
      )
    ) {
      return;
    }
    setActionError("");
    setBusyMemberId(member.id);
    try {
      await removeMember({ companyId, membershipId: member.id }).unwrap();
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, "The member could not be removed."),
      );
    } finally {
      setBusyMemberId("");
    }
  }

  async function revoke(invitationId: string, invitedEmail: string) {
    if (!window.confirm(`Revoke the pending invitation for ${invitedEmail}?`)) {
      return;
    }
    setActionError("");
    setBusyInvitationId(invitationId);
    try {
      await revokeInvitation({ companyId, invitationId }).unwrap();
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, "The invitation could not be revoked."),
      );
    } finally {
      setBusyInvitationId("");
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-primary">
          Company administration
        </p>
        <h2 className="mt-1 font-heading text-2xl font-semibold tracking-tight">
          Team & invitations
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage company memberships and invite colleagues. Removing a member
          does not delete their account.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <h3 className="text-lg">Invite a team member</h3>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={(event) => void submitInvitation(event)}>
            <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field>
                <FieldLabel htmlFor="invite-first-name">First name</FieldLabel>
                <Input
                  id="invite-first-name"
                  required
                  maxLength={100}
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  autoComplete="given-name"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="invite-last-name">Last name</FieldLabel>
                <Input
                  id="invite-last-name"
                  required
                  maxLength={100}
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  autoComplete="family-name"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                <Input
                  id="invite-email"
                  required
                  type="email"
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="invite-role">Company role</FieldLabel>
                <NativeSelect
                  id="invite-role"
                  className="w-full"
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as EInvitationRole)
                  }
                >
                  {invitationRoles.map((option) => (
                    <NativeSelectOption key={option} value={option}>
                      {option}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={inviteState.isLoading}
                  className="w-full"
                >
                  {inviteState.isLoading ? "Sending…" : "Send invitation"}
                </Button>
              </div>
            </FieldGroup>
          </form>
          {inviteError && (
            <Alert variant="destructive">
              <AlertDescription>{inviteError}</AlertDescription>
            </Alert>
          )}
          {inviteSuccess && (
            <Alert role="status">
              <AlertDescription>{inviteSuccess}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-heading text-lg font-semibold">
              Company members
            </h3>
            <p className="text-sm text-muted-foreground">
              {members?.total ?? 0} membership{members?.total === 1 ? "" : "s"}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto]">
            <FieldLabel className="sr-only" htmlFor="member-search">
              Search members
            </FieldLabel>
            <Input
              id="member-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name or email"
            />
            <FieldLabel className="sr-only" htmlFor="member-status">
              Membership status
            </FieldLabel>
            <NativeSelect
              id="member-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as ECompanyUserStatus | "");
                setPage(1);
              }}
            >
              <NativeSelectOption value="">All statuses</NativeSelectOption>
              <NativeSelectOption value={ECompanyUserStatus.ACTIVE}>
                Active
              </NativeSelectOption>
              <NativeSelectOption value={ECompanyUserStatus.INACTIVE}>
                Inactive
              </NativeSelectOption>
            </NativeSelect>
          </div>
        </div>
        {actionError && (
          <Alert variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        {membersLoading ? (
          <Alert role="status">
            <AlertDescription>Loading company members…</AlertDescription>
          </Alert>
        ) : membersError ? (
          <ErrorPanel
            error={membersError}
            message="Company members could not be loaded."
          />
        ) : !members?.items.length ? (
          <Alert role="status">
            <AlertDescription>No members match this search.</AlertDescription>
          </Alert>
        ) : (
          <Card className="gap-0 py-0">
            <div className="divide-y md:hidden">
              {members.items.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  busy={busyMemberId === member.id}
                  onRoleChange={(value) => void updateRole(member, value)}
                  onRemove={() => void remove(member)}
                />
              ))}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader className="bg-muted/50 text-xs uppercase tracking-wide">
                  <TableRow>
                    <TableHead className="px-4">Member</TableHead>
                    <TableHead className="px-4">Role</TableHead>
                    <TableHead className="px-4">Status</TableHead>
                    <TableHead className="px-4">Joined</TableHead>
                    <TableHead className="px-4">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.items.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="px-4 py-3">
                        <p className="font-medium">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <MemberRoleSelect
                          member={member}
                          busy={busyMemberId === member.id}
                          onChange={(value) => void updateRole(member, value)}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant="secondary" className="capitalize">
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        {member.status === ECompanyUserStatus.ACTIVE && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyMemberId === member.id}
                            onClick={() => void remove(member)}
                          >
                            {busyMemberId === member.id ? "Saving…" : "Remove"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <CardFooter className="justify-between border-t py-3 text-sm">
              <span className="text-muted-foreground">
                Page {members.page} of{" "}
                {Math.max(1, Math.ceil(members.total / members.limit))}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((n) => n - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * members.limit >= members.total}
                  onClick={() => setPage((n) => n + 1)}
                >
                  Next
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="font-heading text-lg font-semibold">Invitations</h3>
          <p className="text-sm text-muted-foreground">
            Invitation links are single-use and expire after seven days.
          </p>
        </div>
        {invitationsLoading ? (
          <Alert role="status">
            <AlertDescription>Loading invitations…</AlertDescription>
          </Alert>
        ) : invitationsError ? (
          <ErrorPanel
            error={invitationsError}
            message="Invitations could not be loaded."
          />
        ) : !invitations?.items.length ? (
          <Alert role="status">
            <AlertDescription>No invitations have been sent.</AlertDescription>
          </Alert>
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader className="bg-muted/50 text-xs uppercase tracking-wide">
                <TableRow>
                  <TableHead className="px-4">Recipient</TableHead>
                  <TableHead className="px-4">Role</TableHead>
                  <TableHead className="px-4">Status</TableHead>
                  <TableHead className="px-4">Expires</TableHead>
                  <TableHead className="px-4">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.items.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="px-4 py-3">
                      {invitation.firstName} {invitation.lastName}
                      <p className="text-xs text-muted-foreground">
                        {invitation.email}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {invitation.companyRole}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="secondary" className="capitalize">
                        {invitation.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      {invitation.status === EInvitationStatus.PENDING &&
                        new Date(invitation.expiresAt) > new Date() && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyInvitationId === invitation.id}
                            onClick={() =>
                              void revoke(invitation.id, invitation.email)
                            }
                          >
                            {busyInvitationId === invitation.id
                              ? "Revoking…"
                              : "Revoke"}
                          </Button>
                        )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}

function MemberRoleSelect({
  member,
  busy,
  onChange,
}: {
  member: CompanyMember;
  busy: boolean;
  onChange: (value: string) => void;
}) {
  if (member.status !== ECompanyUserStatus.ACTIVE) {
    return <span>{member.companyRole}</span>;
  }
  return (
    <NativeSelect
      aria-label={`Role for ${member.firstName} ${member.lastName}`}
      disabled={busy}
      value={member.companyRole}
      onChange={(event) => onChange(event.target.value)}
      className="max-w-64"
    >
      {memberRoles.map((option) => (
        <NativeSelectOption key={option} value={option}>
          {option}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

function MemberCard({
  member,
  busy,
  onRoleChange,
  onRemove,
}: {
  member: CompanyMember;
  busy: boolean;
  onRoleChange: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <article className="space-y-3 p-4">
      <div>
        <p className="font-medium">
          {member.firstName} {member.lastName}
        </p>
        <p className="text-xs text-muted-foreground">{member.email}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Status: <span className="capitalize">{member.status}</span> · Joined{" "}
        {new Date(member.joinedAt).toLocaleDateString()}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MemberRoleSelect member={member} busy={busy} onChange={onRoleChange} />
        {member.status === ECompanyUserStatus.ACTIVE && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onRemove}
          >
            {busy ? "Saving…" : "Remove"}
          </Button>
        )}
      </div>
    </article>
  );
}

function ErrorPanel({ error, message }: { error: unknown; message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{message}</AlertTitle>
      <AlertDescription>
        {getApiErrorMessage(error, "Please try again.")}
      </AlertDescription>
    </Alert>
  );
}
