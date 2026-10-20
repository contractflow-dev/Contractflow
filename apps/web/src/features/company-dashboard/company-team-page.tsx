"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ECompanyRole,
  ECompanyUserStatus,
  EInvitationRole,
  EInvitationStatus,
} from "@contractflow/contracts-schema";
import { Button } from "@workspace/ui/components/button";
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
import { CompanyAdminWorkspace } from "./company-admin-workspace";

const invitationRoles = Object.values(EInvitationRole);
const memberRoles = Object.values(ECompanyRole);

export function CompanyTeamPage({
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

      <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        <h3 className="font-heading text-lg font-semibold">
          Invite a team member
        </h3>
        <form
          onSubmit={(event) => void submitInvitation(event)}
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <Field label="First name">
            <input
              required
              maxLength={100}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className={inputClass}
              autoComplete="given-name"
            />
          </Field>
          <Field label="Last name">
            <input
              required
              maxLength={100}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className={inputClass}
              autoComplete="family-name"
            />
          </Field>
          <Field label="Email">
            <input
              required
              type="email"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              autoComplete="email"
            />
          </Field>
          <Field label="Company role">
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as EInvitationRole)
              }
              className={inputClass}
            >
              {invitationRoles.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
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
        </form>
        {inviteError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {inviteError}
          </p>
        )}
        {inviteSuccess && (
          <p
            role="status"
            className="mt-3 text-sm text-emerald-700 dark:text-emerald-400"
          >
            {inviteSuccess}
          </p>
        )}
      </section>

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
            <label className="sr-only" htmlFor="member-search">
              Search members
            </label>
            <input
              id="member-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name or email"
              className={inputClass}
            />
            <label className="sr-only" htmlFor="member-status">
              Membership status
            </label>
            <select
              id="member-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as ECompanyUserStatus | "");
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">All statuses</option>
              <option value={ECompanyUserStatus.ACTIVE}>Active</option>
              <option value={ECompanyUserStatus.INACTIVE}>Inactive</option>
            </select>
          </div>
        </div>
        {actionError && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {actionError}
          </p>
        )}

        {membersLoading ? (
          <p
            role="status"
            className="rounded-xl border bg-card p-6 text-sm text-muted-foreground"
          >
            Loading company members…
          </p>
        ) : membersError ? (
          <ErrorPanel
            error={membersError}
            message="Company members could not be loaded."
          />
        ) : !members?.items.length ? (
          <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            No members match this search.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
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
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.items.map((member) => (
                    <tr key={member.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <MemberRoleSelect
                          member={member}
                          busy={busyMemberId === member.id}
                          onChange={(value) => void updateRole(member, value)}
                        />
                      </td>
                      <td className="px-4 py-3 capitalize">{member.status}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
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
            </div>
          </div>
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
          <p
            role="status"
            className="rounded-xl border bg-card p-6 text-sm text-muted-foreground"
          >
            Loading invitations…
          </p>
        ) : invitationsError ? (
          <ErrorPanel
            error={invitationsError}
            message="Invitations could not be loaded."
          />
        ) : !invitations?.items.length ? (
          <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            No invitations have been sent.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invitations.items.map((invitation) => (
                  <tr key={invitation.id}>
                    <td className="px-4 py-3">
                      {invitation.firstName} {invitation.lastName}
                      <p className="text-xs text-muted-foreground">
                        {invitation.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">{invitation.companyRole}</td>
                    <td className="px-4 py-3 capitalize">
                      {invitation.status}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    <select
      aria-label={`Role for ${member.firstName} ${member.lastName}`}
      disabled={busy}
      value={member.companyRole}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 max-w-64 rounded-md border border-input bg-background px-2 text-xs"
    >
      {memberRoles.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

function ErrorPanel({ error, message }: { error: unknown; message: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="font-medium text-destructive">{message}</p>
      <p role="alert" className="mt-1 text-sm text-muted-foreground">
        {getApiErrorMessage(error, "Please try again.")}
      </p>
    </div>
  );
}

const inputClass =
  "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";
