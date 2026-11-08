"use client";

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
import { Input } from "@workspace/ui/components/input";
import {
  FormField,
  FormGrid,
  RequiredFieldsNote,
} from "@/components/forms/form-field";
import { getApiErrorMessage } from "@/lib/apiError";
import { todayAsCalendarDate } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
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
  // The local date: a UTC date would reject today's signing near midnight.
  const today = todayAsCalendarDate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    if (!("error" in result)) notifySuccess("Signatory saved");
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Your company's signatory"
      className="space-y-4"
    >
      <RequiredFieldsNote />
      <FormGrid columns={2} className="lg:grid-cols-4">
        <FormField id="signatory-first-name" label="First name" required>
          {(control) => (
            <Input
              {...control}
              name="signatoryFirstName"
              autoComplete="off"
              defaultValue={signatory.signatoryFirstName ?? ""}
              maxLength={100}
              required
            />
          )}
        </FormField>
        <FormField id="signatory-last-name" label="Last name" required>
          {(control) => (
            <Input
              {...control}
              name="signatoryLastName"
              autoComplete="off"
              defaultValue={signatory.signatoryLastName ?? ""}
              maxLength={100}
              required
            />
          )}
        </FormField>
        <FormField
          id="signatory-title"
          label="Job title"
          required
          description="Their position in your company."
        >
          {(control) => (
            <Input
              {...control}
              name="signatoryTitle"
              autoComplete="off"
              defaultValue={signatory.signatoryTitle ?? ""}
              maxLength={150}
              required
            />
          )}
        </FormField>
        <FormField
          id="signatory-signed-at"
          label="Signing date"
          required
          description="Can't be later than today."
        >
          {(control) => (
            <Input
              {...control}
              name="signedAt"
              type="date"
              max={today}
              defaultValue={signatory.signedAt?.slice(0, 10) ?? ""}
              required
            />
          )}
        </FormField>
      </FormGrid>
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
      <Button
        type="submit"
        disabled={recordState.isLoading}
        aria-busy={recordState.isLoading || undefined}
      >
        {recordState.isLoading ? "Saving…" : "Save signatory"}
      </Button>
    </form>
  );
}
