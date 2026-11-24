"use client";

import { useState, type FormEvent } from "react";
import { ECompanyRole } from "@contractflow/contracts-schema";
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
import { FormField, FormGrid } from "@/components/forms/form-field";
import { getApiErrorMessage } from "@/lib/apiError";
import { emailFieldError } from "@/lib/email-field";
import { notifySuccess } from "@/lib/notify";
import { useInviteCompanyMemberMutation } from "@/features/companies";

/**
 * A company invitation grants company membership only. Contract roles are
 * assigned per contract, from the contract's role management, after joining.
 */
const invitationRoles: ReadonlyArray<{ value: ECompanyRole; label: string }> = [
  { value: ECompanyRole.MEMBER, label: "Member" },
  { value: ECompanyRole.COMPANY_ADMIN, label: "Company Administrator" },
];

/**
 * Invites someone to the company by email, from the Team page's Invite
 * member action. The API decides who may invite.
 */
export function InviteMemberDialog({
  companyId,
  open,
  onOpenChange,
}: {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* Remounted on every open, so it always starts empty. */}
        {open ? (
          <InviteMemberForm
            companyId={companyId}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** The form inside the dialog; exported for tests. */
export function InviteMemberForm({
  companyId,
  onDone,
}: {
  companyId: string;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<ECompanyRole>(ECompanyRole.MEMBER);
  const [emailError, setEmailError] = useState<string>();
  const [failure, setFailure] = useState("");
  const [inviteMember, inviteState] = useInviteCompanyMemberMutation();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inviteState.isLoading) return;
    setFailure("");
    const invalid = emailFieldError(email);
    setEmailError(invalid);
    if (invalid) return;
    try {
      await inviteMember({
        companyId,
        data: {
          email: email.trim().toLowerCase(),
          ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
          ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
          companyRole: role,
        },
      }).unwrap();
      notifySuccess(
        "Invitation sent",
        `${email.trim()} can now join the team.`,
      );
      onDone();
    } catch (error) {
      setFailure(
        getApiErrorMessage(error, "The invitation could not be sent."),
      );
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      aria-label="Invite a team member"
      className="space-y-5"
    >
      <DialogHeader>
        <DialogTitle>Invite a team member</DialogTitle>
        <DialogDescription>
          We&apos;ll email a single-use invitation link that expires after seven
          days. This adds them to the company only: contract roles are assigned
          on each contract after they join.
        </DialogDescription>
      </DialogHeader>

      <FormGrid columns={2}>
        <FormField
          id="invite-email"
          label="Email"
          required
          error={emailError}
          className="sm:col-span-2"
        >
          {(control) => (
            <Input
              {...control}
              type="email"
              maxLength={254}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailError(undefined);
              }}
              autoComplete="off"
            />
          )}
        </FormField>
        <FormField id="invite-first-name" label="First name (optional)">
          {(control) => (
            <Input
              {...control}
              maxLength={100}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="off"
            />
          )}
        </FormField>
        <FormField id="invite-last-name" label="Last name (optional)">
          {(control) => (
            <Input
              {...control}
              maxLength={100}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="off"
            />
          )}
        </FormField>
        <FormField
          id="invite-role"
          label="Company role"
          className="sm:col-span-2"
        >
          {(control) => (
            <NativeSelect
              {...control}
              className="w-full"
              value={role}
              onChange={(event) => {
                const next = invitationRoles.find(
                  (option) => option.value === event.target.value,
                );
                if (next) setRole(next.value);
              }}
            >
              {invitationRoles.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </FormGrid>

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
          disabled={inviteState.isLoading}
          aria-busy={inviteState.isLoading || undefined}
        >
          {inviteState.isLoading ? "Sending…" : "Send Invitation"}
        </Button>
      </DialogFooter>
    </form>
  );
}
