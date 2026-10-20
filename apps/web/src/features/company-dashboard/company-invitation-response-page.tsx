"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import {
  useGetPublicCompanyInvitationQuery,
  useRespondToCompanyInvitationMutation,
} from "@/features/companies";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { useGetCurrentUserQuery } from "@/services/authApi";

export function CompanyInvitationResponsePage({ token }: { token: string }) {
  const router = useRouter();
  const [result, setResult] = useState("");
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
  const [respond, { isLoading }] = useRespondToCompanyInvitationMutation();
  const isSignedOut = getApiErrorStatus(userError) === 401;
  const redirectToInvitation = `/invitations/respond?token=${encodeURIComponent(token)}`;
  const loginHref = `/login?redirect=${encodeURIComponent(redirectToInvitation)}`;
  const matchesRecipient =
    user?.email.toLowerCase() === invitation?.email.toLowerCase();

  async function makeDecision(decision: "accept" | "decline") {
    setResponseError("");
    setResult("");
    try {
      await respond({ token, decision }).unwrap();
      if (decision === "accept") {
        router.replace("/dashboards");
      } else {
        setResult("You declined this company invitation.");
      }
    } catch (error) {
      setResponseError(
        getApiErrorMessage(error, "Your response could not be submitted."),
      );
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-background p-4">
      <section className="w-full max-w-xl space-y-5 rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div>
          <p className="text-sm font-semibold text-primary">ContractFlow</p>
          <h1 className="mt-2 font-heading text-2xl font-semibold">
            Company invitation
          </h1>
        </div>
        {!token ? (
          <p role="alert" className="text-sm text-destructive">
            This invitation link is missing its token.
          </p>
        ) : isLoadingInvitation || isLoadingUser ? (
          <p role="status" className="text-sm text-muted-foreground">
            Checking invitation…
          </p>
        ) : invitationError ? (
          <p role="alert" className="text-sm text-destructive">
            {getApiErrorMessage(
              invitationError,
              "This invitation is invalid, expired, or no longer available.",
            )}
          </p>
        ) : invitation ? (
          <>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">{invitation.companyName}</span>{" "}
                invited <span className="font-medium">{invitation.email}</span>{" "}
                as <span className="font-medium">{invitation.companyRole}</span>
                .
              </p>
              <p className="text-muted-foreground">
                Expires {new Date(invitation.expiresAt).toLocaleString()}.
              </p>
            </div>
            {isSignedOut ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Sign in using the invited email address to accept or decline.
                </p>
                <Button onClick={() => router.push(loginHref)}>
                  Sign in to respond
                </Button>
                <p className="text-xs text-muted-foreground">
                  If you don’t have an account,{" "}
                  <Link
                    className="underline underline-offset-4"
                    href="/auth/register"
                  >
                    create one
                  </Link>{" "}
                  using this email address, verify it, then reopen this link.
                </p>
              </div>
            ) : user ? (
              <>
                {!user.emailVerifiedAt && (
                  <p role="alert" className="text-sm text-destructive">
                    Verify your email address before responding to this
                    invitation.
                  </p>
                )}
                {!matchesRecipient && (
                  <p role="alert" className="text-sm text-destructive">
                    You are signed in as {user.email}. Sign in with the invited
                    address to respond.
                  </p>
                )}
                {responseError && (
                  <p role="alert" className="text-sm text-destructive">
                    {responseError}
                  </p>
                )}
                {result && (
                  <p
                    role="status"
                    className="text-sm text-emerald-700 dark:text-emerald-400"
                  >
                    {result}
                  </p>
                )}
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    disabled={
                      isLoading || !matchesRecipient || !user.emailVerifiedAt
                    }
                    onClick={() => void makeDecision("decline")}
                  >
                    Decline
                  </Button>
                  <Button
                    disabled={
                      isLoading || !matchesRecipient || !user.emailVerifiedAt
                    }
                    onClick={() => void makeDecision("accept")}
                  >
                    {isLoading ? "Submitting…" : "Accept invitation"}
                  </Button>
                </div>
              </>
            ) : (
              <p role="alert" className="text-sm text-destructive">
                {getApiErrorMessage(
                  userError,
                  "Your session could not be verified.",
                )}
              </p>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
