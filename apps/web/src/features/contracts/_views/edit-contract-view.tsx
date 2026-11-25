"use client";

import Link from "next/link";
import { useId, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { PageHeader } from "@/components/page-header/page-header";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { CompanyAdminShell } from "@/features/companies/CompanyAdminShell";
import {
  useGetContractByIdQuery,
  useGetContractLifecyclePermissionsQuery,
} from "@/services/contractApi";
import { EditContractWizard } from "../components/edit-contract-form";
import {
  CONTRACT_UNAVAILABLE_TEXT,
  contractSectionHref,
} from "../contract-sections";
import { isContractValueLocked } from "../create-contract-schema";

const backLinkClass = "text-sm text-primary underline-offset-4 hover:underline";

export function EditContractView({ contractId }: { contractId: string }) {
  return (
    <CompanyAdminShell>
      {(access) => (
        <EditContractPage
          companyId={access.company.id}
          contractId={contractId}
        />
      )}
    </CompanyAdminShell>
  );
}

/**
 * A contract's details in the New contract steps, as their own page. Only
 * the creating company's Company Administrator may edit (the API's
 * `canManage`), and never an archived contract; the API checks again.
 */
export function EditContractPage({
  companyId,
  contractId,
}: {
  companyId: string;
  contractId: string;
}) {
  const query = { companyId, contractId };
  const detail = useGetContractByIdQuery(query);
  const permissions = useGetContractLifecyclePermissionsQuery(query);
  const contractHref = contractSectionHref(contractId, "overview");

  if (detail.isLoading || permissions.isLoading) {
    return (
      <p
        role="status"
        className="py-12 text-center text-sm text-muted-foreground"
      >
        Loading contract…
      </p>
    );
  }

  const contract = detail.currentData?.contract;
  const notFound = getApiErrorStatus(detail.error) === 404;
  if (!contract || detail.error) {
    return (
      <Notice backHref={contractHref}>
        {notFound
          ? `Contract was not found. ${CONTRACT_UNAVAILABLE_TEXT}`
          : getApiErrorMessage(detail.error, "Unable to load this contract.")}
      </Notice>
    );
  }
  if (!permissions.currentData?.canManage || contract.deletedAt) {
    return (
      <Notice backHref={contractHref}>
        {contract.deletedAt
          ? "This contract is archived, so its details can't change. Restore it first."
          : "Only a Company Administrator of the company that created this contract can edit its details."}
      </Notice>
    );
  }

  return (
    <EditContractForm
      companyId={companyId}
      contract={contract}
      partyType={detail.currentData!.membership.partyType}
      parentContract={detail.currentData!.parentContract ?? null}
      contractHref={contractHref}
    />
  );
}

function Notice({
  backHref,
  children,
}: {
  backHref: string;
  children: string;
}) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-4">
      <Link className={backLinkClass} href={backHref}>
        Back to the contract
      </Link>
      <PageHeader title="Edit contract" />
      <Alert>
        <AlertDescription>{children}</AlertDescription>
      </Alert>
    </div>
  );
}

function EditContractForm({
  companyId,
  contract,
  partyType,
  parentContract,
  contractHref,
}: {
  companyId: string;
  contract: Parameters<typeof EditContractWizard>[0]["contract"];
  partyType: Parameters<typeof EditContractWizard>[0]["partyType"];
  parentContract: Parameters<typeof EditContractWizard>[0]["parentContract"];
  contractHref: string;
}) {
  const router = useRouter();
  const formId = useId();
  const [dirty, setDirty] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  useUnsavedChangesWarning(dirty);

  const leave = () => router.push(contractHref);
  const requestLeave = () => {
    if (dirty) setConfirmingLeave(true);
    else leave();
  };
  const onBackLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Modified clicks (new tab, new window) keep this form open.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (!dirty) return;
    event.preventDefault();
    setConfirmingLeave(true);
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <div className="space-y-4">
        <Link
          className={backLinkClass}
          href={contractHref}
          onClick={onBackLinkClick}
        >
          Back to the contract
        </Link>
        {/* Only the page title above; the rest is in its card. */}
        <PageHeader title="Edit contract" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="break-words">
              {contract.referenceNumber} · {contract.title}
            </h2>
          </CardTitle>
          <CardDescription>
            {isContractValueLocked(contract)
              ? "Change the contract's details, terms and dates. Its original value and currency are fixed now that it has left draft."
              : "Change the contract's details, terms and dates. Party type and workspaces are managed on the contract's Overview."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditContractWizard
            formId={formId}
            companyId={companyId}
            contract={contract}
            partyType={partyType}
            parentContract={parentContract}
            onCancel={requestLeave}
            onDirtyChange={setDirty}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmingLeave}
        title="Discard your changes?"
        description="Your changes to this contract haven't been saved. Leaving now discards them."
        confirmLabel="Discard and leave"
        pendingLabel="Leaving…"
        destructive
        onConfirm={() => {
          setConfirmingLeave(false);
          leave();
        }}
        onCancel={() => setConfirmingLeave(false)}
      />
    </div>
  );
}
