"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  ECompanyRole,
  ECompanyUserStatus,
  EInvitationStatus,
} from "@contractflow/contracts-schema";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { FormField, FormGrid } from "@/components/forms/form-field";
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
import type { ICompanyMember } from "@contractflow/contracts-schema";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { DataPagination } from "@/components/pagination/data-pagination";
import {
  StatusBadge,
  effectiveInvitationStatus,
} from "@/components/status-badge/status-badge";
import {
  StatusLegendDisclosure,
  type StatusLegendItem,
} from "@/components/status-badge/status-legend";
import { PageHeader } from "@/components/page-header/page-header";
import { CompanyContractRoles } from "../components/company-contract-roles";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useKeepPageInRange, usePagination } from "@/hooks/use-pagination";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDate } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { CompanyAdminShell } from "../CompanyAdminShell";

const memberRoles = Object.values(ECompanyRole);

/**
 * A company invitation grants company membership only. Contract roles are
 * assigned per contract, from the contract's role management, after joining.
 */
const invitationRoles: ReadonlyArray<{ value: ECompanyRole; label: string }> = [
  { value: ECompanyRole.MEMBER, label: "Member" },
  { value: ECompanyRole.COMPANY_ADMIN, label: "Company Administrator" },
];

/** What each company invitation status means for the person invited. */
const invitationStatusLegend: StatusLegendItem[] = [
  {
    status: EInvitationStatus.PENDING,
    description: "Sent and waiting for a response. It can still be revoked.",
  },
  {
    status: EInvitationStatus.ACCEPTED,
    description: "The recipient accepted and joined the company.",
  },
  {
    status: EInvitationStatus.DECLINED,
    description: "The recipient declined the invitation.",
  },
  {
    status: EInvitationStatus.EXPIRED,
    description: "Not accepted within seven days. The link no longer works.",
  },
  {
    status: EInvitationStatus.REVOKED,
    description: "Cancelled by an administrator. The link no longer works.",
  },
];

export function CompanyTeamView() {
  return (
    <CompanyAdminShell>
      {(access) => <TeamContent companyId={access.company.id} />}
    </CompanyAdminShell>
  );
}

function TeamContent({ companyId }: { companyId: string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ECompanyUserStatus | "">("");
  const memberPages = usePagination();
  const invitationPages = usePagination(10);
  const debouncedSearch = useDebouncedValue(search.trim());
  const [appliedSearch, setAppliedSearch] = useState(debouncedSearch);
  // A new search term restarts at page 1 in the same render that applies it,
  // so no request is made for the new term on the old page.
  if (appliedSearch !== debouncedSearch) {
    setAppliedSearch(debouncedSearch);
    memberPages.resetPage();
  }
  const timeZone = useUserTimeZone();
  const [inviteError, setInviteError] = useState("");
  // Each confirmation keeps its target open with the last failure, so a
  // failed request stays in the dialog until it succeeds or is cancelled.
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    member: ICompanyMember;
    companyRole: ECompanyRole;
  } | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<ICompanyMember | null>(
    null,
  );
  const [invitationToRevoke, setInvitationToRevoke] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [busyMemberId, setBusyMemberId] = useState("");
  const [busyInvitationId, setBusyInvitationId] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<ECompanyRole>(ECompanyRole.MEMBER);
  const {
    currentData: members,
    error: membersError,
    isLoading: membersInitialLoading,
    isFetching: membersFetching,
  } = useGetCompanyMembersQuery({
    companyId,
    page: memberPages.page,
    limit: memberPages.limit,
    search: appliedSearch || undefined,
    status: status || undefined,
  });
  const membersLoading = membersInitialLoading || (membersFetching && !members);
  useKeepPageInRange(members?.meta, memberPages.setPage);
  const {
    currentData: invitations,
    error: invitationsError,
    isLoading: invitationsInitialLoading,
    isFetching: invitationsFetching,
  } = useGetCompanyInvitationsQuery({
    companyId,
    page: invitationPages.page,
    limit: invitationPages.limit,
  });
  const invitationsLoading =
    invitationsInitialLoading || (invitationsFetching && !invitations);
  useKeepPageInRange(invitations?.meta, invitationPages.setPage);
  const [inviteMember, inviteState] = useInviteCompanyMemberMutation();
  const [changeRole, changeRoleState] = useChangeCompanyMemberRoleMutation();
  const [removeMember, removeMemberState] = useRemoveCompanyMemberMutation();
  const [revokeInvitation, revokeInvitationState] =
    useRevokeCompanyInvitationMutation();

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteError("");
    try {
      await inviteMember({
        companyId,
        data: {
          email: email.trim().toLowerCase(),
          ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
          ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
          companyRole: role,
        },
      }).unwrap();
      notifySuccess(
        "Invitation sent",
        `${email.trim()} can now join the team.`,
      );
      setEmail("");
      setFirstName("");
      setLastName("");
    } catch (error) {
      setInviteError(
        getApiErrorMessage(error, "The invitation could not be sent."),
      );
    }
  }

  // The role select stays on the saved role until the change is confirmed,
  // so cancelling leaves it unchanged.
  function requestRoleChange(member: ICompanyMember, value: string) {
    const companyRole = memberRoles.find((option) => option === value);
    if (!companyRole || companyRole === member.companyRole) return;
    setDialogError("");
    setPendingRoleChange({ member, companyRole });
  }

  async function confirmRoleChange() {
    if (!pendingRoleChange || changeRoleState.isLoading) return;
    const { member, companyRole } = pendingRoleChange;
    setDialogError("");
    setBusyMemberId(member.id);
    try {
      await changeRole({
        companyId,
        membershipId: member.id,
        companyRole,
      }).unwrap();
      setPendingRoleChange(null);
      notifySuccess(
        "Role changed",
        `${member.firstName} ${member.lastName} is now ${companyRole}.`,
      );
    } catch (error) {
      setDialogError(
        getApiErrorMessage(error, "The member role could not be changed."),
      );
    } finally {
      setBusyMemberId("");
    }
  }

  function requestRemoval(member: ICompanyMember) {
    setDialogError("");
    setMemberToRemove(member);
  }

  async function confirmRemoval() {
    if (!memberToRemove || removeMemberState.isLoading) return;
    const member = memberToRemove;
    setDialogError("");
    setBusyMemberId(member.id);
    try {
      await removeMember({ companyId, membershipId: member.id }).unwrap();
      setMemberToRemove(null);
      notifySuccess(
        "Member removed",
        `${member.firstName} ${member.lastName} no longer has access to this company.`,
      );
    } catch (error) {
      setDialogError(
        getApiErrorMessage(error, "The member could not be removed."),
      );
    } finally {
      setBusyMemberId("");
    }
  }

  function requestRevocation(invitationId: string, invitedEmail: string) {
    setDialogError("");
    setInvitationToRevoke({ id: invitationId, email: invitedEmail });
  }

  async function confirmRevocation() {
    if (!invitationToRevoke || revokeInvitationState.isLoading) return;
    const invitation = invitationToRevoke;
    setDialogError("");
    setBusyInvitationId(invitation.id);
    try {
      await revokeInvitation({
        companyId,
        invitationId: invitation.id,
      }).unwrap();
      setInvitationToRevoke(null);
      notifySuccess(
        "Invitation revoked",
        `The invitation for ${invitation.email} no longer works.`,
      );
    } catch (error) {
      setDialogError(
        getApiErrorMessage(error, "The invitation could not be revoked."),
      );
    } finally {
      setBusyInvitationId("");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Company administration"
        title="Team & invitations"
        description="Manage company memberships and invite colleagues. Removing a member does not delete their account."
      />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Invite a team member</h2>
          </CardTitle>
          <CardDescription>
            We&apos;ll email a single-use invitation link that expires after
            seven days. This adds them to the company only: contract roles are
            assigned on each contract after they join.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(event) => void submitInvitation(event)}
            aria-label="Invite a team member"
          >
            <FormGrid columns={2} className="items-end">
              <FormField id="invite-email" label="Email">
                {(control) => (
                  <Input
                    {...control}
                    required
                    type="email"
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="off"
                  />
                )}
              </FormField>
              <FormField id="invite-first-name" label="First name (optional)">
                {(control) => (
                  <Input
                    {...control}
                    maxLength={100}
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    autoComplete="off"
                  />
                )}
              </FormField>
              <FormField id="invite-last-name" label="Last name (optional)">
                {(control) => (
                  <Input
                    {...control}
                    maxLength={100}
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    autoComplete="off"
                  />
                )}
              </FormField>
              <FormField id="invite-role" label="Company role">
                {(control) => (
                  <NativeSelect
                    {...control}
                    className="w-full"
                    value={role}
                    onChange={(event) => {
                      const next = invitationRoles.find(
                        (option) => option.value === event.target.value,
                      );
                      if (next) setRole(next.value);
                    }}
                  >
                    {invitationRoles.map((option) => (
                      <NativeSelectOption key={option.value} value={option.value}>
                        {option.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
              <Button
                type="submit"
                disabled={inviteState.isLoading}
                aria-busy={inviteState.isLoading || undefined}
                className="w-full sm:w-auto lg:w-full"
              >
                {inviteState.isLoading ? "Sending…" : "Send invitation"}
              </Button>
            </FormGrid>
          </form>
          {inviteError && (
            <Alert variant="destructive">
              <AlertDescription>{inviteError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <section>
        <Card className="gap-0 py-0">
          <CardHeader className="gap-4">
            {/* Section heading and membership count */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>
                  <h2 className="type-section-title">Company members</h2>
                </CardTitle>
                <CardDescription>
                  {members?.meta.totalItems ?? 0} membership
                  {members?.meta.totalItems === 1 ? "" : "s"}
                </CardDescription>
              </div>
            </div>

            {/* Member filters */}
            <div className="grid gap-3 border-t pt-4 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-end">
              <div className="space-y-1.5">
                <label htmlFor="member-search" className="text-sm font-medium">
                  Search members
                </label>
                <Input
                  id="member-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name or email"
                  aria-label="Search members by name or email"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="member-status" className="text-sm font-medium">
                  Membership status
                </label>
                <NativeSelect
                  id="member-status"
                  className="w-full"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as ECompanyUserStatus | "");
                    memberPages.resetPage();
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
          </CardHeader>

          {/* Members content */}
          <CardContent className="p-0">
            {membersLoading ? (
              <div className="p-4">
                <Alert role="status">
                  <AlertDescription>Loading company members…</AlertDescription>
                </Alert>
              </div>
            ) : membersError ? (
              <div className="p-4">
                <ErrorPanel
                  error={membersError}
                  message="Company members could not be loaded."
                />
              </div>
            ) : !members?.data.length ? (
              <div className="p-4">
                <Alert role="status">
                  <AlertDescription>
                    No members match this search.
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <>
                {/* Mobile member cards */}
                <div className="divide-y md:hidden">
                  {members.data.map((member) => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      busy={busyMemberId === member.id}
                      onRoleChange={(value) => requestRoleChange(member, value)}
                      timeZone={timeZone}
                      onRemove={() => requestRemoval(member)}
                    />
                  ))}
                </div>

                {/* Desktop members table */}
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
                      {members.data.map((member) => (
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
                              onChange={(value) =>
                                requestRoleChange(member, value)
                              }
                            />
                          </TableCell>

                          <TableCell className="px-4 py-3">
                            <StatusBadge status={member.status} />
                          </TableCell>

                          <TableCell className="px-4 py-3">
                            {formatDate(member.joinedAt, { timeZone })}
                          </TableCell>

                          <TableCell className="px-4 py-3 text-right">
                            {member.status === ECompanyUserStatus.ACTIVE && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busyMemberId === member.id}
                                onClick={() => requestRemoval(member)}
                              >
                                {busyMemberId === member.id
                                  ? "Saving…"
                                  : "Remove"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>

          {/* Pagination */}
          {members &&
            !membersLoading &&
            !membersError &&
            members.data.length > 0 && (
              <CardFooter className="border-t py-3">
                <DataPagination
                  className="w-full"
                  meta={members.meta}
                  itemLabel="members"
                  isFetching={membersFetching}
                  onPageChange={memberPages.setPage}
                  onPageSizeChange={memberPages.setLimit}
                />
              </CardFooter>
            )}
        </Card>
      </section>

      <CompanyContractRoles companyId={companyId} />

      <section className="space-y-4">
        <div>
          <h2 className="type-section-title">Invitations</h2>
          <p className="type-lead">
            Invitations sent from this company and where each one stands.
          </p>
          <StatusLegendDisclosure
            className="mt-1"
            label="What do invitation statuses mean?"
            items={invitationStatusLegend}
          />
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
        ) : !invitations?.data.length ? (
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
                {invitations.data.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="px-4 py-3">
                      {invitation.firstName || invitation.lastName
                        ? [invitation.firstName, invitation.lastName]
                            .filter(Boolean)
                            .join(" ")
                        : "Invitee"}
                      <p className="text-xs text-muted-foreground">
                        {invitation.email}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {invitation.companyRole}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <StatusBadge
                        status={effectiveInvitationStatus(
                          invitation.status,
                          invitation.expiresAt,
                        )}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {formatDate(invitation.expiresAt, { timeZone })}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      {invitation.status === EInvitationStatus.PENDING &&
                        new Date(invitation.expiresAt) > new Date() && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyInvitationId === invitation.id}
                            onClick={() =>
                              requestRevocation(invitation.id, invitation.email)
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
            <CardFooter className="border-t py-3">
              <DataPagination
                className="w-full"
                meta={invitations.meta}
                itemLabel="invitations"
                isFetching={invitationsFetching}
                onPageChange={invitationPages.setPage}
                onPageSizeChange={invitationPages.setLimit}
              />
            </CardFooter>
          </Card>
        )}
      </section>

      <ConfirmDialog
        open={pendingRoleChange !== null}
        title="Change this member's role?"
        description={
          pendingRoleChange
            ? describeRoleChange(
                pendingRoleChange.member,
                pendingRoleChange.companyRole,
              )
            : ""
        }
        confirmLabel="Change role"
        pendingLabel="Changing role…"
        isPending={changeRoleState.isLoading}
        error={pendingRoleChange ? dialogError : undefined}
        destructive={
          pendingRoleChange?.member.companyRole === ECompanyRole.COMPANY_ADMIN
        }
        onConfirm={() => void confirmRoleChange()}
        onCancel={() => setPendingRoleChange(null)}
      />

      <ConfirmDialog
        open={memberToRemove !== null}
        title="Remove this member?"
        description={
          memberToRemove
            ? `${memberToRemove.firstName} ${memberToRemove.lastName} (${memberToRemove.email}) will lose access to this company and its contracts. Their user account is not deleted, and they can be invited again later.`
            : ""
        }
        confirmLabel="Remove member"
        pendingLabel="Removing…"
        isPending={removeMemberState.isLoading}
        error={memberToRemove ? dialogError : undefined}
        destructive
        onConfirm={() => void confirmRemoval()}
        onCancel={() => setMemberToRemove(null)}
      />

      <ConfirmDialog
        open={invitationToRevoke !== null}
        title="Revoke this invitation?"
        description={
          invitationToRevoke
            ? `The invitation sent to ${invitationToRevoke.email} will stop working. This can't be undone, but you can send a new invitation.`
            : ""
        }
        confirmLabel="Revoke invitation"
        pendingLabel="Revoking…"
        isPending={revokeInvitationState.isLoading}
        error={invitationToRevoke ? dialogError : undefined}
        destructive
        onConfirm={() => void confirmRevocation()}
        onCancel={() => setInvitationToRevoke(null)}
      />
    </div>
  );
}

function describeRoleChange(
  member: ICompanyMember,
  companyRole: ECompanyRole,
): string {
  const name = `${member.firstName} ${member.lastName}`;
  const change = `${name} will change from ${member.companyRole} to ${companyRole}.`;
  if (member.companyRole === ECompanyRole.COMPANY_ADMIN) {
    return `${change} They will lose access to company administration: the overview, team management, invitations, and the company profile.`;
  }
  if (companyRole === ECompanyRole.COMPANY_ADMIN) {
    return `${change} They will be able to manage members, invitations, and the company profile.`;
  }
  return change;
}

function MemberRoleSelect({
  member,
  busy,
  onChange,
}: {
  member: ICompanyMember;
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
  timeZone,
  onRoleChange,
  onRemove,
}: {
  member: ICompanyMember;
  busy: boolean;
  timeZone: string | undefined;
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
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <StatusBadge status={member.status} />
        <span>Joined {formatDate(member.joinedAt, { timeZone })}</span>
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
