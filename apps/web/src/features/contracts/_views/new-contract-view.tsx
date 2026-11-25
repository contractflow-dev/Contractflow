"use client";

import Link from "next/link";
import { Suspense, useId, useState, type MouseEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isUlid } from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Card, CardContent } from "@workspace/ui/components/card";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { PageHeader } from "@/components/page-header/page-header";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
import { CompanyAdminShell } from "@/features/companies/CompanyAdminShell";
import { CreateContractWizard } from "../components/create-contract-form";
import { CONTRACTS_PATH } from "../contract-sections";

const backLinkClass = "text-sm text-primary underline-offset-4 hover:underline";

export function NewContractView() {
  return (
    <Suspense fallback={null}>
      <NewContractRoute />
    </Suspense>
  );
}

function NewContractRoute() {
  // `?parent=` opens the form as a subcontract of that main contract. The
  // id is only a starting value: the API decides who may subcontract it.
  const parent = useSearchParams().get("parent");
  const parentContractId = parent && isUlid(parent) ? parent : undefined;
  return (
    <CompanyAdminShell>
      {(access) =>
        // A main contract is created by a Company Administrator; a
        // subcontract by the main contract's Contractor Project Lead. The API
        // makes the same checks when the contract is created.
        parentContractId || access.membership.canManageCompany ? (
          <NewContractPage
            companyId={access.company.id}
            parentContractId={parentContractId}
          />
        ) : (
          <div className="space-y-4">
            <Link className={backLinkClass} href={CONTRACTS_PATH}>
              Back to contracts
            </Link>
            <PageHeader title="New contract" />
            <Alert>
              <AlertDescription>
                Only Company Administrators can create contracts. Ask one to
                create the contract and give you a role on it.
              </AlertDescription>
            </Alert>
          </div>
        )
      }
    </CompanyAdminShell>
  );
}

/** The New contract form as its own page under the contract register. */
export function NewContractPage({
  companyId,
  parentContractId,
}: {
  companyId: string;
  /** Set to create a subcontract of this main contract. */
  parentContractId?: string;
}) {
  const router = useRouter();
  const formId = useId();
  const [dirty, setDirty] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  useUnsavedChangesWarning(dirty);

  const leave = () => router.push(CONTRACTS_PATH);
  const requestLeave = () => {
    if (dirty) setConfirmingLeave(true);
    else leave();
  };
  const onBackLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Let modified clicks (new tab, new window) through: they keep this form.
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
          href={CONTRACTS_PATH}
          onClick={onBackLinkClick}
        >
          Back to contracts
        </Link>
        <PageHeader
          title={parentContractId ? "New subcontract" : "New contract"}
          description={
            parentContractId
              ? "Create a draft subcontract that your company awards. You lead it, and invite the subcontractor once the draft exists."
              : "Create a draft contract for this company. You can invite the other parties and assign roles once the draft exists."
          }
        />
      </div>

      <Card>
        <CardContent>
          <CreateContractWizard
            formId={formId}
            companyId={companyId}
            parentContractId={parentContractId}
            onCancel={requestLeave}
            onDirtyChange={setDirty}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmingLeave}
        title="Discard this contract?"
        description="The details you've entered haven't been saved. Leaving now discards them."
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
