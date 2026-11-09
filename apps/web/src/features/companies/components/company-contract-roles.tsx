"use client";

import Link from "next/link";
import { useState } from "react";
import { ECompanyUserStatus } from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { DataPagination } from "@/components/pagination/data-pagination";
import { contractSectionHref } from "@/features/contracts/contract-sections";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDate, humanizeEnumValue } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { useGetCompanyMembersQuery } from "@/services/companiesApi";
import {
  useGetCompanyRoleAssignmentsQuery,
  useRevokeContractRoleMutation,
  type AssignableContractWorkspace,
  type CompanyRoleAssignment,
} from "@/services/contractApi";

const WORKSPACES: AssignableContractWorkspace[] = ["project", "hse", "finance"];
/** The API's largest page; enough members for the filter list. */
const MEMBER_OPTIONS_LIMIT = 100;

/**
 * Every contract role the company's members hold, across its contracts that
 * are not archived ("Can view every role assignment at my company"). Roles
 * are assigned on each contract; here they can be reviewed and revoked.
 */
export function CompanyContractRoles({ companyId }: { companyId: string }) {
  const timeZone = useUserTimeZone();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [member, setMember] = useState("");
  const [workspace, setWorkspace] = useState<AssignableContractWorkspace | "">(
    "",
  );
  const [revoking, setRevoking] = useState<CompanyRoleAssignment | null>(null);
  const roles = useGetCompanyRoleAssignmentsQuery(
    {
      companyId,
      page,
      limit,
      ...(member ? { companyUserId: member } : {}),
      ...(workspace ? { workspace } : {}),
    },
    // Roles also change on each contract's Roles section.
    { refetchOnMountOrArgChange: true },
  );
  const members = useGetCompanyMembersQuery({
    companyId,
    page: 1,
    limit: MEMBER_OPTIONS_LIMIT,
    status: ECompanyUserStatus.ACTIVE,
  });
  const [revoke, revokeState] = useRevokeContractRoleMutation();
  const data = roles.currentData;
  const filtered = Boolean(member || workspace);
  const clearFilters = () => {
    setMember("");
    setWorkspace("");
    setPage(1);
  };

  return (
    <section aria-labelledby="contract-roles-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="contract-roles-heading" className="type-section-title">
          Contract roles
        </h2>
        <p className="type-lead">
          Roles your members hold on your company&apos;s contracts. Assign new
          roles from a contract&apos;s Roles section.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <Field>
          <FieldLabel htmlFor="contract-roles-member">Member</FieldLabel>
          <NativeSelect
            id="contract-roles-member"
            className="w-full"
            value={member}
            onChange={(event) => {
              setMember(event.target.value);
              setPage(1);
            }}
          >
            <NativeSelectOption value="">All members</NativeSelectOption>
            {(members.currentData?.data ?? []).map((option) => (
              <NativeSelectOption key={option.id} value={option.id}>
                {`${option.firstName} ${option.lastName}`.trim() ||
                  option.email}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="contract-roles-workspace">Workspace</FieldLabel>
          <NativeSelect
            id="contract-roles-workspace"
            className="w-full"
            value={workspace}
            onChange={(event) => {
              const value = event.target.value;
              setWorkspace(WORKSPACES.find((w) => w === value) ?? "");
              setPage(1);
            }}
          >
            <NativeSelectOption value="">All workspaces</NativeSelectOption>
            {WORKSPACES.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {humanizeEnumValue(option)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Card className="gap-0 py-0">
        {roles.isLoading ? (
          <div
            role="status"
            aria-label="Loading contract roles"
            className="space-y-3 p-4"
          >
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-12 w-full" />
            ))}
            <span className="sr-only">Loading contract roles…</span>
          </div>
        ) : roles.error ? (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {getApiErrorMessage(
                    roles.error,
                    "Contract roles could not be loaded.",
                  )}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void roles.refetch()}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : data?.data.length ? (
          <>
            {/* Phones: one card per role. */}
            <ul className="divide-y md:hidden">
              {data.data.map((row) => (
                <li key={row.id} className="space-y-2 p-4">
                  <RoleMember row={row} />
                  <RoleContract row={row} />
                  <p className="flex flex-wrap items-center gap-1.5 text-sm">
                    {row.role} · {humanizeEnumValue(row.workspace)}
                    {row.isWorkspaceAdmin ? (
                      <Badge variant="info">Workspace admin</Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Assigned {formatDate(row.assignedAt, { timeZone })}
                  </p>
                  <RevokeButton row={row} onRevoke={setRevoking} />
                </li>
              ))}
            </ul>
            {/* From md: a table. */}
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-normal">
                        <RoleMember row={row} />
                      </TableCell>
                      <TableCell className="max-w-72 whitespace-normal">
                        <RoleContract row={row} />
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <p>{row.role}</p>
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {humanizeEnumValue(row.workspace)}
                          {row.isWorkspaceAdmin ? (
                            <Badge variant="info">Workspace admin</Badge>
                          ) : null}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(row.assignedAt, { timeZone })}
                      </TableCell>
                      <TableCell className="text-end">
                        <RevokeButton row={row} onRevoke={setRevoking} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DataPagination
              className="border-t p-4"
              meta={data.meta}
              itemLabel="roles"
              isFetching={roles.isFetching}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setLimit(size);
                setPage(1);
              }}
            />
          </>
        ) : filtered ? (
          <div className="space-y-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No contract roles match these filters.
            </p>
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="space-y-2 p-6 text-center">
            <h3 className="font-semibold">No contract roles yet</h3>
            <p className="mx-auto max-w-prose text-sm leading-6 text-muted-foreground">
              Members get access to a contract&apos;s workspaces when you assign
              them a role from that contract&apos;s Roles section.
            </p>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={revoking !== null}
        title="Revoke this contract role?"
        description={
          revoking
            ? `${revoking.firstName} ${revoking.lastName} will lose the ${revoking.role} role on “${revoking.contractTitle}” straight away. Records they created stay on the contract.`
            : ""
        }
        error={
          revokeState.error
            ? getApiErrorMessage(
                revokeState.error,
                "The role couldn't be revoked.",
              )
            : undefined
        }
        confirmLabel="Revoke role"
        pendingLabel="Revoking…"
        isPending={revokeState.isLoading}
        destructive
        onCancel={() => {
          revokeState.reset();
          setRevoking(null);
        }}
        onConfirm={() => {
          if (!revoking) return;
          const row = revoking;
          // The contract's own route and checks decide; including that a
          // workspace keeps at least one administrator.
          void revoke({
            companyId,
            contractId: row.contractId,
            workspace: row.workspace,
            assignmentId: row.id,
          })
            .unwrap()
            .then(() => {
              notifySuccess(
                "Contract role revoked",
                `${row.role} on ${row.contractTitle}`,
              );
              revokeState.reset();
              setRevoking(null);
              void roles.refetch();
            })
            .catch(() => {
              // Shown in the dialog through `revokeState.error`.
            });
        }}
      />
    </section>
  );
}

function RoleMember({ row }: { row: CompanyRoleAssignment }) {
  return (
    <div className="min-w-0">
      <p className="font-medium break-words">
        {`${row.firstName} ${row.lastName}`.trim() || row.email}
      </p>
      <p className="text-xs break-words text-muted-foreground">{row.email}</p>
    </div>
  );
}

function RoleContract({ row }: { row: CompanyRoleAssignment }) {
  return (
    <div className="min-w-0">
      <Link
        href={contractSectionHref(row.contractId, "roles")}
        className="font-medium break-words text-primary underline-offset-4 hover:underline"
      >
        {row.contractTitle}
      </Link>
      <p className="text-xs break-words text-muted-foreground">
        {row.contractReference}
      </p>
    </div>
  );
}

function RevokeButton({
  row,
  onRevoke,
}: {
  row: CompanyRoleAssignment;
  onRevoke: (row: CompanyRoleAssignment) => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      aria-label={`Revoke ${row.role} from ${row.firstName} ${row.lastName} on ${row.contractTitle}`}
      onClick={() => onRevoke(row)}
    >
      Revoke
    </Button>
  );
}
