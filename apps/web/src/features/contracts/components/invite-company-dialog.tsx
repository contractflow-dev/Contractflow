"use client";

import { useState, type FormEvent } from "react";
import { EPartyType } from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { FormField } from "@/components/forms/form-field";
import { getApiErrorMessage } from "@/lib/apiError";
import { emailFieldError } from "@/lib/email-field";
import { notifySuccess } from "@/lib/notify";
import {
  useCreateContractPartyInvitationMutation,
  type Contract,
} from "@/services/contractApi";

/**
 * Invites another company to be a party to this contract. This is not a
 * company team invitation: nobody joins the inviting company.
 */
export function InviteCompanyDialog({
  companyId,
  contract,
  open,
  onOpenChange,
}: {
  companyId: string;
  contract: Pick<Contract, "id" | "referenceNumber" | "title">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* Remounted on every open, so it always starts empty. */}
        {open ? (
          <InviteCompanyForm
            companyId={companyId}
            contract={contract}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function InviteCompanyForm({
  companyId,
  contract,
  onDone,
}: {
  companyId: string;
  contract: Pick<Contract, "id" | "referenceNumber" | "title">;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [partyType, setPartyType] = useState<EPartyType>(EPartyType.CONTRACTOR);
  const [emailError, setEmailError] = useState<string>();
  const [failure, setFailure] = useState("");
  const [createInvitation, state] = useCreateContractPartyInvitationMutation();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.isLoading) return;
    setFailure("");
    const invalid = emailFieldError(email);
    setEmailError(invalid);
    if (invalid) return;
    try {
      await createInvitation({
        companyId,
        contractId: contract.id,
        email: email.trim(),
        partyType,
      }).unwrap();
      notifySuccess(
        "Company invitation sent",
        `${email.trim()} can now accept the invitation to this contract.`,
      );
      onDone();
    } catch (error) {
      setFailure(
        getApiErrorMessage(error, "Unable to send the company invitation."),
      );
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      aria-label="Invite a company"
      className="space-y-5"
    >
      <DialogHeader className="pe-8">
        <DialogTitle>Invite a company</DialogTitle>
        <DialogDescription>
          Invite an active, verified company to join {contract.referenceNumber}{" "}
          · {contract.title}, using the email address on its company profile.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <FormField
          id="party-invitation-email"
          label="Company email"
          required
          error={emailError}
        >
          {(control) => (
            <Input
              {...control}
              type="email"
              autoComplete="off"
              maxLength={254}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailError(undefined);
              }}
            />
          )}
        </FormField>
        <FormField id="party-invitation-type" label="Party type">
          {(control) => (
            <NativeSelect
              {...control}
              className="w-full"
              value={partyType}
              onChange={(event) =>
                setPartyType(event.target.value as EPartyType)
              }
            >
              <NativeSelectOption value={EPartyType.CONTRACTOR}>
                Contractor
              </NativeSelectOption>
              <NativeSelectOption value={EPartyType.SUBCONTRACTOR}>
                Subcontractor
              </NativeSelectOption>
            </NativeSelect>
          )}
        </FormField>
      </div>

      {failure ? (
        <Alert variant="destructive">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={state.isLoading}
          aria-busy={state.isLoading || undefined}
        >
          {state.isLoading ? "Sending…" : "Send Invitation"}
        </Button>
      </DialogFooter>
    </form>
  );
}
