"use client";

import { useState } from "react";
import {
  ECompanyMemberSortField,
  ECompanyRole,
  ECompanyUserStatus,
  ESortOrder,
} from "@contractflow/contracts-schema";
import { RiUserAddLine } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import {
  useChangeCompanyMemberRoleMutation,
  useGetCompanyMembersQuery,
  useRemoveCompanyMemberMutation,
} from "@/features/companies";
import type { ICompanyMember } from "@contractflow/contracts-schema";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import {
  DataTable,
  DataTableEmpty,
  DataTableRowActions,
} from "@/components/data-table/data-table";
import {
  DataTableSearch,
  DataTableToolbar,
} from "@/components/data-table/data-table-toolbar";
import { DataTableFilters } from "@/components/data-table/data-table-filters";
import { ListCard } from "@/components/data-table/list-card";
import { DropdownMenuItem } from "@workspace/ui/components/dropdown-menu";
import { StatusBadge } from "@/components/status-badge/status-badge";
import { PageHeader } from "@/components/page-header/page-header";
import { MemberDetailsSheet } from "../components/member-details-sheet";
import { TeamDialogs, useTeamDialog } from "../components/team-dialogs";
import { TeamSummary } from "../components/team-summary";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useKeepPageInRange, usePagination } from "@/hooks/use-pagination";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDate } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { CompanyAdminShell } from "../CompanyAdminShell";

const memberRoles = Object.values(ECompanyRole);

/** Member list orders the API supports; newest first is its default. */
const memberSorts = [
  {
    value: "joined-desc",
    label: "Newest first",
    sortBy: ECompanyMemberSortField.JOINED_AT,
    sortOrder: ESortOrder.DESC,
  },
  {
    value: "joined-asc",
    label: "Oldest first",
    sortBy: ECompanyMemberSortField.JOINED_AT,
    sortOrder: ESortOrder.ASC,
  },
  {
    value: "name-asc",
    label: "Name (A–Z)",
    sortBy: ECompanyMemberSortField.NAME,
    sortOrder: ESortOrder.ASC,
  },
  {
    value: "name-desc",
    label: "Name (Z–A)",
    sortBy: ECompanyMemberSortField.NAME,
    sortOrder: ESortOrder.DESC,
  },
] as const;
type MemberSort = (typeof memberSorts)[number]["value"];

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
  const [roleFilter, setRoleFilter] = useState<ECompanyRole | "">("");
  const [sort, setSort] = useState<MemberSort>("joined-desc");
  const sortOption =
    memberSorts.find((option) => option.value === sort) ?? memberSorts[0];
  const [selectedMember, setSelectedMember] = useState<ICompanyMember | null>(
    null,
  );
  const memberPages = usePagination();
  const debouncedSearch = useDebouncedValue(search.trim());
  const [appliedSearch, setAppliedSearch] = useState(debouncedSearch);
  // A new search term restarts at page 1 in the same render that applies it,
  // so no request is made for the new term on the old page.
  if (appliedSearch !== debouncedSearch) {
    setAppliedSearch(debouncedSearch);
    memberPages.resetPage();
  }
  const timeZone = useUserTimeZone();
  // Invite member and Invitations open from the URL (?dialog=), as the
  // Team sub-navigation does.
  const teamDialog = useTeamDialog();
  // Each confirmation keeps its target open with the last failure, so a
  // failed request stays in the dialog until it succeeds or is cancelled.
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    member: ICompanyMember;
    companyRole: ECompanyRole;
  } | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<ICompanyMember | null>(
    null,
  );
  const [dialogError, setDialogError] = useState("");
  const [busyMemberId, setBusyMemberId] = useState("");
  const {
    currentData: members,
    error: membersError,
    isLoading: membersInitialLoading,
    isFetching: membersFetching,
    refetch: refetchMembers,
  } = useGetCompanyMembersQuery({
    companyId,
    page: memberPages.page,
    limit: memberPages.limit,
    search: appliedSearch || undefined,
    status: status || undefined,
    companyRole: roleFilter || undefined,
    sortBy: sortOption.sortBy,
    sortOrder: sortOption.sortOrder,
  });
  const membersLoading = membersInitialLoading || (membersFetching && !members);
  useKeepPageInRange(members?.meta, memberPages.setPage);
  const [changeRole, changeRoleState] = useChangeCompanyMemberRoleMutation();
  const [removeMember, removeMemberState] = useRemoveCompanyMemberMutation();

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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Team"
        title="Company members"
        description="Manage company memberships and invite colleagues. Removing a member does not delete their account."
      />

      <TeamSummary companyId={companyId} />

      <ListCard
        title="Members"
        description={`${members?.meta.totalItems ?? 0} membership${
          members?.meta.totalItems === 1 ? "" : "s"
        }`}
        action={
          <Button
            type="button"
            aria-haspopup="dialog"
            onClick={() => teamDialog.open("invite")}
          >
            <RiUserAddLine aria-hidden="true" data-icon="inline-start" />
            Invite Team Member
          </Button>
        }
      >
        <div className="space-y-3">
          <DataTableToolbar
            actions={
              <div className="flex items-center gap-2">
                <label
                  htmlFor="member-sort"
                  className="text-sm whitespace-nowrap text-muted-foreground"
                >
                  Sort by
                </label>
                <NativeSelect
                  id="member-sort"
                  value={sort}
                  onChange={(event) => {
                    const next = memberSorts.find(
                      (option) => option.value === event.target.value,
                    );
                    if (!next) return;
                    setSort(next.value);
                    memberPages.resetPage();
                  }}
                >
                  {memberSorts.map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            }
          >
            {/* Typing searches after a short pause; Enter needs no extra
                step. */}
            <DataTableSearch
              id="member-search"
              label="Search members by name or email"
              formLabel="Company members"
              placeholder="Search by name or email"
              value={search}
              onChange={setSearch}
              onSubmit={(event) => event.preventDefault()}
              onClear={() => setSearch("")}
            />
            <DataTableFilters
              label="members"
              fields={[
                {
                  kind: "select",
                  id: "status",
                  label: "Membership status",
                  value: status,
                  options: [
                    { value: "", label: "All members" },
                    { value: ECompanyUserStatus.ACTIVE, label: "Active" },
                    { value: ECompanyUserStatus.INACTIVE, label: "Inactive" },
                  ],
                },
                {
                  kind: "select",
                  id: "role",
                  label: "Company role",
                  value: roleFilter,
                  options: [
                    { value: "", label: "All roles" },
                    ...memberRoles.map((value) => ({ value, label: value })),
                  ],
                },
              ]}
              onApply={(next) => {
                setStatus(next.status as typeof status);
                setRoleFilter(
                  memberRoles.find((option) => option === next.role) ?? "",
                );
                memberPages.resetPage();
              }}
            />
          </DataTableToolbar>
        </div>

        <DataTable
          label="Company members"
          columns={[
            {
              id: "member",
              header: "Member",
              wrap: true,
              className: "min-w-44",
              cell: (member) => (
                <>
                  <p className="font-medium">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {member.email}
                  </p>
                </>
              ),
            },
            {
              id: "role",
              header: "Role",
              cell: (member) => (
                <MemberRoleSelect
                  member={member}
                  busy={busyMemberId === member.id}
                  onChange={(value) => requestRoleChange(member, value)}
                />
              ),
            },
            {
              id: "status",
              header: "Status",
              cell: (member) => <StatusBadge status={member.status} />,
            },
            {
              id: "joined",
              header: "Joined",
              className: "tabular-nums",
              cell: (member) => formatDate(member.joinedAt, { timeZone }),
            },
          ]}
          rows={members?.data ?? []}
          getRowKey={(member) => member.id}
          rowActions={(member) => (
            <DataTableRowActions
              label={`Actions for ${member.firstName} ${member.lastName}`}
            >
              <DropdownMenuItem onClick={() => setSelectedMember(member)}>
                View details and contract roles
              </DropdownMenuItem>
              {/* Removing asks for confirmation first. */}
              {member.status === ECompanyUserStatus.ACTIVE ? (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={busyMemberId === member.id}
                  onClick={() => requestRemoval(member)}
                >
                  Remove from company…
                </DropdownMenuItem>
              ) : null}
            </DataTableRowActions>
          )}
          renderCard={(member) => (
            <MemberCard
              member={member}
              busy={busyMemberId === member.id}
              onRoleChange={(value) => requestRoleChange(member, value)}
              timeZone={timeZone}
              onRemove={() => requestRemoval(member)}
              onDetails={() => setSelectedMember(member)}
            />
          )}
          isLoading={membersLoading}
          loadingLabel="Loading company members…"
          error={
            membersError
              ? `Company members could not be loaded. ${getApiErrorMessage(
                  membersError,
                  "Please try again.",
                )}`
              : null
          }
          onRetry={() => void refetchMembers()}
          empty={
            appliedSearch || status || roleFilter ? (
              <DataTableEmpty
                title="No members match these filters."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setStatus("");
                      setRoleFilter("");
                      memberPages.resetPage();
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <DataTableEmpty
                title="No members yet."
                description="Invite colleagues with Invite member. They appear here once they accept."
              />
            )
          }
          pagination={
            members
              ? {
                  meta: members.meta,
                  itemLabel: "members",
                  isFetching: membersFetching,
                  onPageChange: memberPages.setPage,
                  onPageSizeChange: memberPages.setLimit,
                }
              : undefined
          }
        />
      </ListCard>

      <MemberDetailsSheet
        companyId={companyId}
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
      />

      <TeamDialogs companyId={companyId} />

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
  onDetails,
}: {
  member: ICompanyMember;
  busy: boolean;
  timeZone: string | undefined;
  onRoleChange: (value: string) => void;
  onRemove: () => void;
  onDetails: () => void;
}) {
  return (
    <div className="space-y-3">
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
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDetails}
            aria-label={`View details and contract roles for ${member.firstName} ${member.lastName}`}
          >
            Details
          </Button>
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
      </div>
    </div>
  );
}
