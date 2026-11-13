"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Inbox, MailOpen } from "lucide-react";
import type {
  ECompanyRole,
  IMyCompanyInvitation,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  useGetMyCompanyInvitationsQuery,
  useRespondToMyCompanyInvitationMutation,
} from "@/features/companies";
import { getApiErrorMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { useGetCurrentUserQuery } from "@/services/authApi";
import { useAppDispatch } from "@/store/hooks";
import {
  InvitationDetails,
  InvitationLayout,
  JoinedCompany,
  MembershipScopeNote,
} from "../components/invitation-layout";
import {
  activateJoinedCompany,
  classifyInvitationAnswer,
  joinedCompanyLandingPath,
} from "../joinedCompany";

type Answer = { invitationId: string; decision: "accept" | "decline" };

/**
 * The signed-in user's pending company invitations, found by their verified
 * email address. A new invitee lands here after verifying and signing in, so
 * they join the inviting company instead of being sent to company setup.
 */
export function MyInvitationsView() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { data: user } = useGetCurrentUserQuery();
  const {
    data: invitations,
    error,
    isLoading,
    refetch,
  } = useGetMyCompanyInvitationsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const [respond] = useRespondToMyCompanyInvitationMutation();
  const [answering, setAnswering] = useState<Answer | null>(null);
  const [joined, setJoined] = useState<{
    companyName: string;
    companyRole: ECompanyRole;
  } | null>(null);
  const [notice, setNotice] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  if (joined) {
    return (
      <JoinedCompany
        {...joined}
        onContinue={() =>
          router.replace(joinedCompanyLandingPath(joined.companyRole))
        }
      />
    );
  }

  async function answer(
    invitation: IMyCompanyInvitation,
    decision: "accept" | "decline",
  ) {
    if (answering) return;
    setNotice(null);
    setAnswering({ invitationId: invitation.id, decision });
    try {
      const answered = classifyInvitationAnswer(
        await respond({ invitationId: invitation.id, decision }).unwrap(),
      );
      if (answered.kind === "joined") {
        activateJoinedCompany(dispatch, user?.id, answered.companyId);
        setJoined({
          companyName: invitation.companyName,
          companyRole: invitation.companyRole,
        });
      } else if (answered.kind === "declined") {
        setNotice({
          text: `You declined the invitation from ${invitation.companyName}.`,
          isError: false,
        });
      } else {
        setNotice({
          text: `The invitation from ${invitation.companyName} has expired. Ask the company administrator to send a new one.`,
          isError: true,
        });
      }
    } catch (failure) {
      setNotice({
        text: getApiErrorMessage(
          failure,
          "Your response could not be submitted. Try again.",
        ),
        isError: true,
      });
    } finally {
      setAnswering(null);
    }
  }

  if (isLoading) {
    return (
      <InvitationLayout title="Your invitations">
        <div role="status" className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <span className="sr-only">Loading your invitations…</span>
        </div>
      </InvitationLayout>
    );
  }

  if (error) {
    return (
      <InvitationLayout title="Your invitations">
        <Alert variant="destructive">
          <AlertDescription>
            {getApiErrorMessage(error, "Your invitations couldn't be loaded.")}
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void refetch()}
        >
          Try again
        </Button>
      </InvitationLayout>
    );
  }

  const pending = invitations ?? [];
  const statusNotice = notice && (
    <Alert
      variant={notice.isError ? "destructive" : "default"}
      role={notice.isError ? "alert" : "status"}
    >
      <AlertDescription>{notice.text}</AlertDescription>
    </Alert>
  );

  if (pending.length === 0) {
    return (
      <InvitationLayout
        icon={Inbox}
        title="No pending invitations"
        description="There are no open company invitations for your email address. If you expected one, ask the company administrator to send it again."
      >
        {statusNotice}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboards"
            className={cn(buttonVariants({ variant: "outline" }), "sm:flex-1")}
          >
            Go to ContractFlow
          </Link>
          <Link
            href="/onboarding"
            className={cn(buttonVariants({ variant: "ghost" }), "sm:flex-1")}
          >
            Set up a company instead
          </Link>
        </div>
      </InvitationLayout>
    );
  }

  return (
    <InvitationLayout
      icon={MailOpen}
      title={
        pending.length === 1
          ? `Join ${pending[0].companyName}`
          : "You have company invitations"
      }
      description={
        pending.length === 1
          ? "You've been invited to join this company on ContractFlow."
          : "Accept the invitation from the company you work with."
      }
    >
      {statusNotice}
      <ul className="space-y-5">
        {pending.map((invitation) => {
          const busy = answering?.invitationId === invitation.id;
          return (
            <li key={invitation.id} className="space-y-3">
              <InvitationDetails {...invitation} />
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  disabled={Boolean(answering)}
                  onClick={() => void answer(invitation, "decline")}
                  aria-label={`Decline the invitation from ${invitation.companyName}`}
                >
                  {busy && answering?.decision === "decline"
                    ? "Declining…"
                    : "Decline"}
                </Button>
                <Button
                  disabled={Boolean(answering)}
                  aria-busy={busy || undefined}
                  onClick={() => void answer(invitation, "accept")}
                  aria-label={`Accept the invitation from ${invitation.companyName}`}
                >
                  {busy && answering?.decision === "accept"
                    ? "Joining…"
                    : "Accept invitation"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <MembershipScopeNote />
    </InvitationLayout>
  );
}
