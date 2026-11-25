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
 * company team invitation: nobody joins the inviting company. On a
 * subcontract, the invited company is the subcontractor.
 */
export function InviteCompanyDialog({
  companyId,
  contract,
  subcontract = false,
  open,
  onOpenChange,
}: {
  companyId: string;
  contract: Pick<Contract, "id" | "referenceNumber" | "title">;
  subcontract?: boolean;
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
            subcontract={subcontract}
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
  subcontract,
  onDone,
}: {
  companyId: string;
  contract: Pick<Contract, "id" | "referenceNumber" | "title">;
  subcontract: boolean;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
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
        // An invited company always joins as the awarded party.
        partyType: EPartyType.AWARDED,
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
      aria-label={subcontract ? "Invite a subcontractor" : "Invite a company"}
      className="space-y-5"
    >
      <DialogHeader className="pe-8">
        <DialogTitle>
          {subcontract ? "Invite a subcontractor" : "Invite a company"}
        </DialogTitle>
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
        <p className="text-sm text-muted-foreground">
          The company joins this contract as the{" "}
          <span className="font-medium text-foreground">awarded</span> party
          {subcontract ? ": the subcontractor." : "."}
        </p>
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
