"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ECompanyRole,
  ECompanyUserStatus,
  EInvitationRole,
  EInvitationStatus,
} from "@contractflow/contracts-schema";
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
  const [roleDrafts, setRoleDrafts] = useState<Record<string, ECompanyRole>>({});
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
      firstName: String(formData.get("firstName") ?? "").trim(),
      lastName: String(formData.get("lastName") ?? "").trim(),
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
      setFeedback(`${memberName(memberToRemove)} no longer has company access.`);
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
        <p role="status" className="rounded-md border bg-card p-3 text-sm">
          {feedback}
        </p>
      )}
      {failure && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-card p-3 text-sm text-destructive"
        >
          {failure}
        </p>
      )}

      <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Invite a team member</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The invitee must sign in and verify this email address to accept.
          </p>
        </div>
        <form
          onSubmit={(event) => void submitInvitation(event)}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field label="First name" name="firstName" required />
          <Field label="Last name" name="lastName" required />
          <Field label="Email" name="email" type="email" required />
          <label className="grid gap-1.5 text-sm font-medium">
            Company role
            <select
              name="companyRole"
              required
              defaultValue={EInvitationRole.CONTRACTOR_PROJECT_LEAD}
              className="h-10 rounded-md border bg-background px-3 font-normal"
            >
              {Object.values(EInvitationRole).map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={inviteState.isLoading}
            className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
          >
            {inviteState.isLoading ? "Sending invitation…" : "Send invitation"}
          </button>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Company members</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Inactive records remain visible for membership history.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="sr-only" htmlFor="member-search">
              Search members
            </label>
            <input
              id="member-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search members"
              className="h-10 rounded-md border bg-background px-3 text-sm"
            />
            <label className="sr-only" htmlFor="member-status">
              Filter members by status
            </label>
            <select
              id="member-status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="active">Active members</option>
              <option value="inactive">Inactive members</option>
              <option value="all">All statuses</option>
            </select>
          </div>
        </header>
        {membersError ? (
          <p role="alert" className="text-sm text-destructive">
            {getApiErrorMessage(membersError, "Unable to load team members.")}
          </p>
        ) : membersFetching && !members ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading team members…
          </p>
        ) : filteredMembers.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            {members?.length
              ? "No members match these filters."
              : "There are no company members to display."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="px-3 py-3 font-medium">Member</th>
                  <th scope="col" className="px-3 py-3 font-medium">Role</th>
                  <th scope="col" className="px-3 py-3 font-medium">Status</th>
                  <th scope="col" className="px-3 py-3 font-medium">Joined</th>
                  <th scope="col" className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => {
                  const selectedRole =
                    roleDrafts[member.id] ?? member.companyRole;
                  const active = member.status === ECompanyUserStatus.ACTIVE;
                  return (
                    <tr key={member.id} className="border-b last:border-0">
                      <td className="px-3 py-3">
                        <p className="font-medium">{memberName(member)}</p>
                        <p className="text-muted-foreground">{member.email}</p>
                      </td>
                      <td className="px-3 py-3">
                        {active ? (
                          <div className="flex items-center gap-2">
                            <label className="sr-only" htmlFor={`role-${member.id}`}>
                              Role for {memberName(member)}
                            </label>
                            <select
                              id={`role-${member.id}`}
                              value={selectedRole}
                              onChange={(event) =>
                                setRoleDrafts((current) => ({
                                  ...current,
                                  [member.id]: event.target.value as ECompanyRole,
                                }))
                              }
                              className="h-9 max-w-56 rounded-md border bg-background px-2"
                            >
                              {Object.values(ECompanyRole).map((role) => (
                                <option key={role} value={role}>{role}</option>
                              ))}
                            </select>
                            {selectedRole !== member.companyRole && (
                              <button
                                type="button"
                                disabled={updateState.isLoading}
                                onClick={() => void saveRole(member)}
                                className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-60"
                              >
                                Save
                              </button>
                            )}
                          </div>
                        ) : (
                          member.companyRole
                        )}
                      </td>
                      <td className="px-3 py-3 capitalize">{member.status}</td>
                      <td className="px-3 py-3">
                        <time dateTime={member.joinedAt}>
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </time>
                        {member.leftAt && (
                          <p className="text-xs text-muted-foreground">
                            Left {new Date(member.leftAt).toLocaleDateString()}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {active && (
                          <button
                            type="button"
                            onClick={() => setMemberToRemove(member)}
                            className="rounded-md border border-destructive/40 px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Invitations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Invitations expire after seven days and can be used only once.
          </p>
        </div>
        {invitationsError ? (
          <p role="alert" className="text-sm text-destructive">
            {getApiErrorMessage(invitationsError, "Unable to load invitations.")}
          </p>
        ) : invitationsFetching && !invitations ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading invitations…
          </p>
        ) : !invitations?.length ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No invitations have been sent.
          </p>
        ) : (
          <ul className="divide-y">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {invitation.firstName} {invitation.lastName} · {invitation.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {invitation.companyRole} · {invitation.status}
                    {invitation.status === EInvitationStatus.PENDING &&
                      ` · Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`}
                  </p>
                </div>
                {invitation.status === EInvitationStatus.PENDING && (
                  <button
                    type="button"
                    disabled={revokeState.isLoading}
                    onClick={() => void revoke(invitation.id)}
                    className="min-h-9 self-start rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-60 sm:self-auto"
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {memberToRemove && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="remove-member-title"
          aria-describedby="remove-member-description"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
        >
          <section className="w-full max-w-md space-y-4 rounded-xl border bg-background p-6 shadow-xl">
            <h2 id="remove-member-title" className="text-lg font-semibold">
              Remove {memberName(memberToRemove)}?
            </h2>
            <p id="remove-member-description" className="text-sm text-muted-foreground">
              This deactivates company membership while preserving the record.
              Contract-specific assignments are not changed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="min-h-10 rounded-md border px-4 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removeState.isLoading}
                onClick={() => void confirmRemove()}
                className="min-h-10 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground disabled:opacity-60"
              >
                {removeState.isLoading ? "Removing…" : "Remove member"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  required = false,
  type = "text",
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        className="h-10 rounded-md border bg-background px-3 font-normal"
      />
    </label>
  );
}
