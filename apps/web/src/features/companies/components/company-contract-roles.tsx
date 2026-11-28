"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  contractRoleLabel,
  ECompanyUserStatus,
} from "@contractflow/contracts-schema";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { DataTable, DataTableEmpty } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DataTableFilters } from "@/components/data-table/data-table-filters";
import { ListCard } from "@/components/data-table/list-card";
import { contractSectionHref } from "@/features/contracts/contract-sections";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDate, humanizeEnumValue } from "@/lib/format";
import { useGetCompanyMembersQuery } from "@/services/companiesApi";
import {
  useGetCompanyRoleAssignmentsQuery,
  type AssignableContractWorkspace,
  type CompanyRoleAssignment,
} from "@/services/contractApi";
import { AssignContractRoleDialog } from "./assign-contract-role-dialog";
import { ContractRoleActions } from "./contract-role-actions";

const WORKSPACES: AssignableContractWorkspace[] = ["project", "hse", "finance"];
/** The API's largest page; enough members for the filter list. */
const MEMBER_OPTIONS_LIMIT = 100;

/**
 * Every contract role the company's members hold, across its contracts that
 * are not archived ("Can view every role assignment at my company"). Roles
 * can be assigned, reviewed and revoked here or on each contract; either way
 * the contract's own routes and checks apply.
 */
export function CompanyContractRoles({ companyId }: { companyId: string }) {
  const timeZone = useUserTimeZone();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [member, setMember] = useState("");
  // The workspace filter lives in the URL (?workspace=hse), so the
  // dashboard and department pages can open this list already filtered.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspace: AssignableContractWorkspace | "" =
    WORKSPACES.find((w) => w === searchParams.get("workspace")) ?? "";
  const setWorkspace = (next: AssignableContractWorkspace | "") => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("workspace", next);
    else params.delete("workspace");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  };
  const [assigning, setAssigning] = useState(false);
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
  const data = roles.currentData;
  const filtered = Boolean(member || workspace);
  const clearFilters = () => {
    setMember("");
    setWorkspace("");
    setPage(1);
  };

  return (
    <>
      <ListCard
        id="contract-roles"
        headingId="contract-roles-heading"
        title="Role assignments"
        description={
          <>
            Roles your members hold on your company&apos;s contracts. Company
            membership alone gives no contract access: each role opens one
            workspace of one contract.
          </>
        }
        action={
          <Button type="button" onClick={() => setAssigning(true)}>
            Assign a contract role
          </Button>
        }
      >
        <DataTableToolbar>
          <DataTableFilters
            label="contract roles"
            fields={[
              {
                kind: "select",
                id: "workspace",
                label: "Workspace",
                value: workspace,
                options: [
                  { value: "", label: "All workspaces" },
                  ...WORKSPACES.map((option) => ({
                    value: option,
                    label: humanizeEnumValue(option),
                  })),
                ],
              },
              {
                kind: "select",
                id: "member",
                label: "Member",
                value: member,
                options: [
                  { value: "", label: "All members" },
                  ...(members.currentData?.data ?? []).map((option) => ({
                    value: option.id,
                    label: memberName(option),
                  })),
                ],
              },
            ]}
            onApply={(next) => {
              setMember(next.member);
              if (next.workspace !== workspace) {
                setWorkspace(
                  WORKSPACES.find((option) => option === next.workspace) ?? "",
                );
              }
              setPage(1);
            }}
          />
        </DataTableToolbar>

        <DataTable
          label="Contract roles"
          columns={[
            {
              id: "member",
              header: "Member",
              wrap: true,
              cell: (row) => <RoleMember row={row} />,
            },
            {
              id: "contract",
              header: "Contract",
              wrap: true,
              className: "max-w-72",
              cell: (row) => <RoleContract row={row} />,
            },
            {
              id: "role",
              header: "Role",
              wrap: true,
              cell: (row) => (
                <>
                  <p>{contractRoleLabel(row.role, row.isSubcontract)}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {humanizeEnumValue(row.workspace)}
                    {row.isWorkspaceAdmin ? (
                      <Badge variant="info">Workspace admin</Badge>
                    ) : null}
                  </p>
                </>
              ),
            },
            {
              id: "assigned",
              header: "Assigned",
              className: "tabular-nums",
              cell: (row) => formatDate(row.assignedAt, { timeZone }),
            },
          ]}
          rows={data?.data ?? []}
          getRowKey={(row) => row.id}
          rowActions={(row) => (
            <ContractRoleActions companyId={companyId} row={row} />
          )}
          renderCard={(row) => (
            <>
              <RoleMember row={row} />
              <RoleContract row={row} />
              <p className="flex flex-wrap items-center gap-1.5 text-sm">
                {contractRoleLabel(row.role, row.isSubcontract)} ·{" "}
                {humanizeEnumValue(row.workspace)}
                {row.isWorkspaceAdmin ? (
                  <Badge variant="info">Workspace admin</Badge>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                Assigned {formatDate(row.assignedAt, { timeZone })}
              </p>
              <ContractRoleActions companyId={companyId} row={row} />
            </>
          )}
          isLoading={roles.isLoading}
          loadingLabel="Loading contract roles…"
          skeletonRows={3}
          error={
            roles.error
              ? getApiErrorMessage(
                  roles.error,
                  "Contract roles could not be loaded.",
                )
              : null
          }
          onRetry={() => void roles.refetch()}
          empty={
            filtered ? (
              <DataTableEmpty
                title="No contract roles match these filters."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <DataTableEmpty
                title="No contract roles yet"
                description="Members get access to a contract’s workspace when you assign them a role there. Use “Assign a contract role” to give the first one."
              />
            )
          }
          pagination={
            data
              ? {
                  meta: data.meta,
                  itemLabel: "roles",
                  isFetching: roles.isFetching,
                  onPageChange: setPage,
                  onPageSizeChange: (size) => {
                    setLimit(size);
                    setPage(1);
                  },
                }
              : undefined
          }
        />
      </ListCard>

      <AssignContractRoleDialog
        companyId={companyId}
        open={assigning}
        onOpenChange={setAssigning}
      />
    </>
  );
}

function memberName(member: {
  firstName: string;
  lastName: string;
  email: string;
}): string {
  return `${member.firstName} ${member.lastName}`.trim() || member.email;
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
