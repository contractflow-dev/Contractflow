"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { CONTRACT_INVITATIONS_ANCHOR } from "@/features/companies/components/company-notification-bell";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDate, humanizeEnumValue } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import {
  useGetIncomingContractInvitationsQuery,
  useRespondToIncomingContractInvitationMutation,
  type IncomingContractInvitation,
} from "@/services/contractApi";

type Decision = "accept" | "reject";

/**
 * Invitations for this company to join other companies' contracts, answered
 * here instead of only from the email link. Shown to Company Administrators,
 * who are the only ones the API lets answer. Renders nothing when there are
 * none.
 */
export function IncomingContractInvitations({
  companyId,
}: {
  companyId: string;
}) {
  const timeZone = useUserTimeZone();
  const invitations = useGetIncomingContractInvitationsQuery({ companyId });
  const [answering, setAnswering] = useState<{
    invitation: IncomingContractInvitation;
    decision: Decision;
  } | null>(null);
  const [respond, state] = useRespondToIncomingContractInvitationMutation();

  if (invitations.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>
            {getApiErrorMessage(
              invitations.error,
              "Unable to load invitations to contracts.",
            )}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => void invitations.refetch()}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  const list = invitations.currentData ?? [];
  if (!list.length) return null;

  const close = () => {
    state.reset();
    setAnswering(null);
  };

  return (
    // The notification bell links here.
    <Card id={CONTRACT_INVITATIONS_ANCHOR} className="scroll-mt-20">
      <CardHeader>
        <CardTitle>
          <h2>Invitations to contracts</h2>
        </CardTitle>
        <CardDescription>
          Other companies have invited yours to join their contracts. Accepting
          adds your company as a party; you then assign contract roles to your
          team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-2xl border">
          {list.map((invitation) => (
            <li
              key={invitation.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <p className="font-medium break-words">
                  {invitation.contractTitle}
                </p>
                <p className="text-sm break-words text-muted-foreground">
                  {invitation.contractReference} · from{" "}
                  {invitation.invitingCompanyName} · as{" "}
                  {humanizeEnumValue(invitation.partyType)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Expires {formatDate(invitation.expiresAt, { timeZone })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Decline the invitation to ${invitation.contractTitle}`}
                  onClick={() =>
                    setAnswering({ invitation, decision: "reject" })
                  }
                >
                  Decline
                </Button>
                <Button
                  type="button"
                  aria-label={`Accept the invitation to ${invitation.contractTitle}`}
                  onClick={() =>
                    setAnswering({ invitation, decision: "accept" })
                  }
                >
                  Accept
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
      <ConfirmDialog
        open={answering !== null}
        title={
          answering?.decision === "accept"
            ? "Join this contract?"
            : "Decline this invitation?"
        }
        description={
          answering
            ? answering.decision === "accept"
              ? `Your company will join “${answering.invitation.contractTitle}” as ${humanizeEnumValue(answering.invitation.partyType).toLowerCase()}. ${answering.invitation.invitingCompanyName} will be told.`
              : `${answering.invitation.invitingCompanyName} will be told that your company declined. To join later, they'll need to invite you again.`
            : ""
        }
        error={
          state.error
            ? getApiErrorMessage(state.error, "Your answer couldn't be saved.")
            : undefined
        }
        confirmLabel={
          answering?.decision === "accept" ? "Join contract" : "Decline invitation"
        }
        pendingLabel="Saving…"
        isPending={state.isLoading}
        destructive={answering?.decision === "reject"}
        onCancel={close}
        onConfirm={() => {
          if (!answering) return;
          const { invitation, decision } = answering;
          void respond({ companyId, invitationId: invitation.id, decision })
            .unwrap()
            .then(() => {
              notifySuccess(
                decision === "accept"
                  ? "Contract joined"
                  : "Invitation declined",
                invitation.contractTitle,
              );
              close();
            })
            .catch(() => {
              // Shown in the dialog through `state.error`.
            });
        }}
      />
    </Card>
  );
}
