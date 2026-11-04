"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { ECompanyRole } from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { getApiErrorMessage } from "@/lib/apiError";
import { useGetCompanyMembershipQuery } from "@/services/companiesApi";
import {
  useGetContractSignatoryQuery,
  useRecordContractSignatoryMutation,
  type Contract,
  type ContractPartySignatory,
} from "@/services/contractApi";

/**
 * Lets a Company Administrator record their own company's signatory on a
 * contract. Counterparty signatories are never shown here.
 */
export function ContractSignatoryManagement({
  companyId,
  contract,
}: {
  companyId: string;
  contract: Contract;
}) {
  const membershipQuery = useGetCompanyMembershipQuery({ companyId });
  const isCompanyAdmin =
    membershipQuery.data?.membership.companyRole === ECompanyRole.COMPANY_ADMIN;
  const canRecord = isCompanyAdmin && !contract.deletedAt;
  const signatoryQuery = useGetContractSignatoryQuery(
    { companyId, contractId: contract.id },
    { skip: !canRecord },
  );

  if (!canRecord) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your company&apos;s signatory</CardTitle>
        <CardDescription>
          Record who signed this contract on behalf of your company, and when.
          Other parties record their own signatories.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {signatoryQuery.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading signatory…
          </p>
        ) : signatoryQuery.error || !signatoryQuery.data ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {getApiErrorMessage(
                  signatoryQuery.error,
                  "Unable to load the signatory.",
                )}
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => void signatoryQuery.refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <SignatoryForm
            key={signatoryQuery.data.id}
            companyId={companyId}
            contractId={contract.id}
            signatory={signatoryQuery.data}
          />
        )}
      </CardContent>
    </Card>
  );
}

function SignatoryForm({
  companyId,
  contractId,
  signatory,
}: {
  companyId: string;
  contractId: string;
  signatory: ContractPartySignatory;
}) {
  const [recordSignatory, recordState] = useRecordContractSignatoryMutation();
  const [saved, setSaved] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const form = new FormData(event.currentTarget);
    const result = await recordSignatory({
      companyId,
      contractId,
      body: {
        signatoryFirstName: String(form.get("signatoryFirstName") ?? "").trim(),
        signatoryLastName: String(form.get("signatoryLastName") ?? "").trim(),
        signatoryTitle: String(form.get("signatoryTitle") ?? "").trim(),
        signedAt: String(form.get("signedAt") ?? ""),
      },
    });
    if (!("error" in result)) setSaved(true);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field>
          <FieldLabel htmlFor="signatory-first-name">First name</FieldLabel>
          <Input
            id="signatory-first-name"
            name="signatoryFirstName"
            defaultValue={signatory.signatoryFirstName ?? ""}
            maxLength={100}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="signatory-last-name">Last name</FieldLabel>
          <Input
            id="signatory-last-name"
            name="signatoryLastName"
            defaultValue={signatory.signatoryLastName ?? ""}
            maxLength={100}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="signatory-title">Title</FieldLabel>
          <Input
            id="signatory-title"
            name="signatoryTitle"
            defaultValue={signatory.signatoryTitle ?? ""}
            maxLength={150}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="signatory-signed-at">Signing date</FieldLabel>
          <Input
            id="signatory-signed-at"
            name="signedAt"
            type="date"
            max={today}
            defaultValue={signatory.signedAt?.slice(0, 10) ?? ""}
            required
          />
        </Field>
      </div>
      {recordState.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getApiErrorMessage(
              recordState.error,
              "Unable to record the signatory.",
            )}
          </AlertDescription>
        </Alert>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-muted-foreground">
          Signatory saved.
        </p>
      ) : null}
      <Button type="submit" disabled={recordState.isLoading}>
        {recordState.isLoading ? "Saving…" : "Save signatory"}
      </Button>
    </form>
  );
}
