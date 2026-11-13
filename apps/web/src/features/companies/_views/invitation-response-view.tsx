"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MailOpen, MailX, ShieldAlert, UserPlus } from "lucide-react";
import {
  type ECompanyRole,
  EInvitationStatus,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import {
  useGetPublicCompanyInvitationQuery,
  useRespondToCompanyInvitationMutation,
} from "@/features/companies";
import {
  ClosedInvitation,
  InvalidInvitation,
  InvitationDetails,
  InvitationLayout,
  JoinedCompany,
  MembershipScopeNote,
  SwitchAccountButton,
} from "@/features/invitations/components/invitation-layout";
import {
  activateJoinedCompany,
  classifyInvitationAnswer,
  invitationLinkPath,
  invitationRegisterPath,
  invitationSignInPath,
  joinedCompanyLandingPath,
} from "@/features/invitations/joinedCompany";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { useGetCurrentUserQuery } from "@/services/authApi";
import { useAppDispatch } from "@/store/hooks";

// The joined company is kept here: accepting refreshes the preview, which
// then reports the invitation as accepted rather than its details.
type Outcome =
  | { kind: "joined"; companyName: string; companyRole: ECompanyRole }
  | { kind: "declined" }
  | { kind: "closed"; message: string };

/**
 * The page an invitation email links to. It shows the invitation, sends a
 * signed-out person to create an account or sign in (keeping the link), and
 * lets the invited, verified account accept or decline. The API checks the
 * token, expiry, status and email again when they answer.
 */
export function InvitationResponseView({ token }: { token: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [responseError, setResponseError] = useState("");
  const {
    currentData: invitation,
    error: invitationError,
    isLoading: isLoadingInvitation,
  } = useGetPublicCompanyInvitationQuery({ token }, { skip: !token });
  const {
    data: user,
    error: userError,
    isLoading: isLoadingUser,
  } = useGetCurrentUserQuery(undefined, { refetchOnMountOrArgChange: true });
  const [respond, { isLoading: isResponding }] =
    useRespondToCompanyInvitationMutation();
  const isSignedOut = getApiErrorStatus(userError) === 401;

  if (!token) return <InvalidInvitation />;

  if (outcome?.kind === "joined") {
    const { companyName, companyRole } = outcome;
    return (
      <JoinedCompany
        companyName={companyName}
        companyRole={companyRole}
        onContinue={() => router.replace(joinedCompanyLandingPath(companyRole))}
      />
    );
  }
  if (outcome?.kind === "declined") {
    return (
      <InvitationLayout
        icon={MailX}
        title="Invitation declined"
        description="You declined this invitation, so you haven't joined the company. The administrator who invited you has been told."
      >
        <Link
          href="/dashboards"
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          Go to ContractFlow
        </Link>
      </InvitationLayout>
    );
  }
  if (outcome?.kind === "closed") {
    return <InvalidInvitation message={outcome.message} />;
  }

  if (isLoadingInvitation || isLoadingUser) {
    return (
      <InvitationLayout
        title="Checking your invitation"
        description={
          <span role="status">One moment while we check this invitation…</span>
        }
      />
    );
  }
  if (invitationError || !invitation) {
    return getApiErrorStatus(invitationError) === 404 ? (
      <InvalidInvitation />
    ) : (
      <InvalidInvitation
        message={getApiErrorMessage(
          invitationError,
          "This invitation couldn't be checked. Try again in a moment.",
        )}
      />
    );
  }
  if (invitation.status !== EInvitationStatus.PENDING) {
    return <ClosedInvitation status={invitation.status} />;
  }

  const pending = invitation;
  const details = <InvitationDetails {...pending} />;
  const heading = `Join ${pending.companyName} on ContractFlow`;
  const intro = pending.inviterName
    ? `${pending.inviterName} invited you to join ${pending.companyName} as ${pending.companyRole}.`
    : `You've been invited to join ${pending.companyName} as ${pending.companyRole}.`;

  if (isSignedOut) {
    return (
      <InvitationLayout icon={UserPlus} title={heading} description={intro}>
        {details}
        <p className="text-sm leading-6 text-muted-foreground">
          To accept, use a ContractFlow account with{" "}
          <span className="font-medium text-foreground">{pending.email}</span>.
          You don&apos;t need to set up a company.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href={invitationRegisterPath(token)}
            className={cn(buttonVariants({ size: "xl" }), "w-full")}
          >
            Create an account
          </Link>
          <Link
            href={invitationSignInPath(token)}
            className={cn(
              buttonVariants({ variant: "outline", size: "xl" }),
              "w-full",
            )}
          >
            I already have an account
          </Link>
        </div>
      </InvitationLayout>
    );
  }

  if (!user) {
    return (
      <InvitationLayout title={heading} description={intro}>
        <Alert variant="destructive">
          <AlertDescription>
            {getApiErrorMessage(
              userError,
              "Your session could not be verified.",
            )}
          </AlertDescription>
        </Alert>
      </InvitationLayout>
    );
  }

  if (user.email.toLowerCase() !== pending.email.toLowerCase()) {
    return (
      <InvitationLayout
        icon={ShieldAlert}
        tone="warning"
        title="This invitation is for another email address"
        description={
          <>
            You&apos;re signed in as{" "}
            <span className="font-medium text-foreground">{user.email}</span>,
            but this invitation was sent to{" "}
            <span className="font-medium text-foreground">{pending.email}</span>
            . Only that account can accept it.
          </>
        }
      >
        {details}
        <SwitchAccountButton returnTo={invitationLinkPath(token)} />
      </InvitationLayout>
    );
  }

  async function answer(decision: "accept" | "decline") {
    setResponseError("");
    try {
      const answered = classifyInvitationAnswer(
        await respond({ token, decision }).unwrap(),
      );
      if (answered.kind === "joined") {
        activateJoinedCompany(dispatch, user?.id, answered.companyId);
        setOutcome({
          kind: "joined",
          companyName: pending.companyName,
          companyRole: pending.companyRole,
        });
      } else if (answered.kind === "declined") {
        setOutcome({ kind: "declined" });
      } else {
        setOutcome({
          kind: "closed",
          message:
            "This invitation has expired. Ask the company administrator to send a new one.",
        });
      }
    } catch (error) {
      // 409: expired, revoked, already used, or the user is already a member.
      // It can't be answered again, so stop offering the actions.
      if (getApiErrorStatus(error) === 409) {
        setOutcome({
          kind: "closed",
          message: getApiErrorMessage(
            error,
            "This invitation can no longer be answered.",
          ),
        });
        return;
      }
      setResponseError(
        getApiErrorMessage(error, "Your response could not be submitted."),
      );
    }
  }

  return (
    <InvitationLayout icon={MailOpen} title={heading} description={intro}>
      {details}
      <MembershipScopeNote />
      {!user.emailVerifiedAt && (
        <Alert variant="destructive">
          <AlertDescription>
            Verify your email address before responding to this invitation.
          </AlertDescription>
        </Alert>
      )}
      {responseError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{responseError}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          disabled={isResponding || !user.emailVerifiedAt}
          onClick={() => void answer("decline")}
        >
          Decline
        </Button>
        <Button
          disabled={isResponding || !user.emailVerifiedAt}
          aria-busy={isResponding || undefined}
          onClick={() => void answer("accept")}
        >
          {isResponding ? "Submitting…" : "Accept invitation"}
        </Button>
      </div>
    </InvitationLayout>
  );
}
