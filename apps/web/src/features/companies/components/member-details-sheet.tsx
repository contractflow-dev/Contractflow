"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ECompanyRole,
  ECompanyUserStatus,
  type ICompanyMember,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@/components/status-badge/status-badge";
import { contractSectionHref } from "@/features/contracts/contract-sections";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDate, humanizeEnumValue } from "@/lib/format";
import { useGetCompanyRoleAssignmentsQuery } from "@/services/contractApi";
import { AssignContractRoleDialog } from "./assign-contract-role-dialog";
import { ContractRoleActions } from "./contract-role-actions";

/** The API's largest page; a member rarely holds more roles than this. */
const ROLES_LIMIT = 100;

/**
 * One member's company membership and the contract roles they hold. The two
 * are separate: membership gives no contract access, and each role gives
 * access to one workspace of one contract.
 */
export function MemberDetailsSheet({
  companyId,
  member,
  onClose,
}: {
  companyId: string;
  member: ICompanyMember | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-xl"
      >
        {member ? (
          <MemberDetails companyId={companyId} member={member} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** The sheet's content; exported for tests. */
export function MemberDetails({
  companyId,
  member,
}: {
  companyId: string;
  member: ICompanyMember;
}) {
  const timeZone = useUserTimeZone();
  const [assigning, setAssigning] = useState(false);
  const roles = useGetCompanyRoleAssignmentsQuery(
    { companyId, companyUserId: member.id, page: 1, limit: ROLES_LIMIT },
    { refetchOnMountOrArgChange: true },
  );
  const name = `${member.firstName} ${member.lastName}`.trim() || member.email;
  const isActive = member.status === ECompanyUserStatus.ACTIVE;
  const rows = roles.currentData?.data ?? [];

  return (
    <>
      <SheetHeader className="border-b p-5">
        <SheetTitle className="type-section-title">{name}</SheetTitle>
        <SheetDescription className="break-words">
          {member.email}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 p-5">
        <section
          aria-labelledby="member-membership-heading"
          className="space-y-3"
        >
          <h3 id="member-membership-heading" className="font-semibold">
            Company membership
          </h3>
          <dl className="divide-y rounded-lg border text-sm">
            <DetailRow label="Company role">
              <span className="flex flex-wrap items-center gap-2">
                {member.companyRole}
                {member.companyRole === ECompanyRole.COMPANY_ADMIN ? (
                  <Badge variant="info">Manages the company</Badge>
                ) : null}
              </span>
            </DetailRow>
            <DetailRow label="Status">
              <StatusBadge status={member.status} />
            </DetailRow>
            <DetailRow label="Joined">
              {formatDate(member.joinedAt, { timeZone })}
            </DetailRow>
            {member.leftAt ? (
              <DetailRow label="Left">
                {formatDate(member.leftAt, { timeZone })}
              </DetailRow>
            ) : null}
          </dl>
          {member.companyRole === ECompanyRole.COMPANY_ADMIN ? (
            <p className="text-xs leading-5 text-muted-foreground">
              Company administrators oversee contracts but don&apos;t work in a
              contract workspace unless they&apos;re given a role there.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="member-roles-heading" className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 id="member-roles-heading" className="font-semibold">
                Contract roles
              </h3>
              <p className="text-xs leading-5 text-muted-foreground">
                Each role gives access to one workspace of one contract.
              </p>
            </div>
            {isActive ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setAssigning(true)}
              >
                Assign to a contract
              </Button>
            ) : null}
          </div>

          {roles.isLoading ? (
            <div
              role="status"
              aria-label="Loading contract roles"
              className="space-y-2"
            >
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : roles.error ? (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {getApiErrorMessage(
                    roles.error,
                    "Contract roles couldn't be loaded.",
                  )}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void roles.refetch()}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : rows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {isActive
                ? `${name} has no contract roles, so they can't open any contract yet.`
                : `${name} is no longer an active member and holds no contract roles.`}
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {rows.map((row) => (
                <li key={row.id} className="space-y-3 p-4">
                  <div className="min-w-0 space-y-1">
                    <Link
                      href={contractSectionHref(row.contractId, "roles")}
                      className="font-medium break-words text-primary underline-offset-4 hover:underline"
                    >
                      {row.contractTitle}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {row.contractReference}
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5 text-sm">
                      {row.role} · {humanizeEnumValue(row.workspace)} workspace
                      {row.isWorkspaceAdmin ? (
                        <Badge variant="info">Workspace admin</Badge>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Assigned {formatDate(row.assignedAt, { timeZone })}
                    </p>
                  </div>
                  <ContractRoleActions companyId={companyId} row={row} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AssignContractRoleDialog
        companyId={companyId}
        open={assigning}
        onOpenChange={setAssigning}
        member={member}
      />
    </>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[8rem_1fr] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
