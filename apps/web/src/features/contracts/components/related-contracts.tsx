import Link from "next/link";
import { RiAddLine } from "@remixicon/react";
import type {
  ContractListItem,
  ContractRelationSummary,
} from "@contractflow/contracts-schema";
import { buttonVariants } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { StatusBadge } from "@/components/status-badge/status-badge";
import { useGetContractLifecyclePermissionsQuery } from "@/services/contractApi";

function contractHref(id: string) {
  return `/dashboards/contracts/${encodeURIComponent(id)}`;
}

/**
 * " · Subcontract of MAIN-001" after a listed contract's reference. The API
 * names the main contract only when the reader may open it; otherwise the
 * row still says it is a subcontract.
 */
export function SubcontractNote({
  contract,
}: {
  contract: Pick<ContractListItem, "parentContractId" | "parentContract">;
}) {
  if (!contract.parentContractId) return null;
  return (
    <>
      {" · "}
      {contract.parentContract
        ? `Subcontract of ${contract.parentContract.referenceNumber}`
        : "Subcontract"}
    </>
  );
}

/**
 * Under a contract's title: which main contract a subcontract belongs to,
 * linked when the reader may open it.
 */
export function ParentContractLine({
  parentContractId,
  parentContract,
}: {
  parentContractId: string | null;
  parentContract: ContractRelationSummary | null;
}) {
  if (!parentContractId) return null;
  return (
    <p className="mt-3 text-sm text-muted-foreground">
      Subcontract of{" "}
      {parentContract ? (
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href={contractHref(parentContract.id)}
        >
          {parentContract.referenceNumber} · {parentContract.title}
        </Link>
      ) : (
        "a main contract your company is not a party to"
      )}
    </p>
  );
}

/** SubcontractsCard with the caller's permission to create one. */
export function SubcontractsSection({
  companyId,
  contractId,
  subcontracts,
}: {
  companyId: string;
  contractId: string;
  subcontracts: readonly ContractRelationSummary[];
}) {
  const permissions = useGetContractLifecyclePermissionsQuery({
    companyId,
    contractId,
  }).data;
  return (
    <SubcontractsCard
      contractId={contractId}
      subcontracts={subcontracts}
      canCreate={permissions?.canCreateSubcontract === true}
    />
  );
}

/** The create page, opened as a subcontract of `parentContractId`. */
export function newSubcontractHref(parentContractId: string) {
  return `/dashboards/contracts/new?parent=${encodeURIComponent(parentContractId)}`;
}

/**
 * A main contract's subcontracts that the reader may open, and, for the
 * awarded party's Contractor Project Lead, the way to create one. Hidden
 * when there is nothing to show or do; the API checks every action again.
 */
export function SubcontractsCard({
  contractId,
  subcontracts,
  canCreate = false,
}: {
  contractId: string;
  subcontracts: readonly ContractRelationSummary[];
  /** The caller may create a subcontract (lifecycle permissions). */
  canCreate?: boolean;
}) {
  if (subcontracts.length === 0 && !canCreate) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Subcontracts</h2>
        </CardTitle>
        <CardDescription>
          {canCreate
            ? "Separate agreements between your company and each subcontractor. You stay accountable for this contract."
            : "Subcontracts of this contract that you can open."}
        </CardDescription>
        {canCreate ? (
          <div>
            <Link
              href={newSubcontractHref(contractId)}
              className={buttonVariants({ variant: "outline" })}
            >
              <RiAddLine aria-hidden="true" data-icon="inline-start" />
              New subcontract
            </Link>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {subcontracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subcontracts yet.</p>
        ) : (
          <ul className="divide-y">
            {subcontracts.map((subcontract) => (
              <li
                key={subcontract.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <Link
                  className="min-w-0 break-words text-primary underline-offset-4 hover:underline"
                  href={contractHref(subcontract.id)}
                >
                  {subcontract.referenceNumber} · {subcontract.title}
                </Link>
                <StatusBadge status={subcontract.status} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
