"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { useGetCurrentUserQuery } from "@/services/authApi";
import {
  useGetPublicContractPartyInvitationQuery,
  useRespondToContractPartyInvitationMutation,
} from "@/services/contractApi";

export function ContractPartyInvitationResponse({
  token,
}: {
  token: string;
}) {
  const router = useRouter();
  const [responseError, setResponseError] = useState("");
  const [result, setResult] = useState("");
  const {
    currentData: invitation,
    error: invitationError,
    isLoading: isLoadingInvitation,
  } = useGetPublicContractPartyInvitationQuery({ token }, { skip: !token });
  const {
    data: user,
    error: userError,
    isLoading: isLoadingUser,
  } = useGetCurrentUserQuery(undefined, { refetchOnMountOrArgChange: true });
  const [respond, { isLoading }] = useRespondToContractPartyInvitationMutation();
  const isSignedOut = getApiErrorStatus(userError) === 401;
  const responseUrl = `/invitations/contract-party?token=${encodeURIComponent(token)}`;
  const loginHref = `/login?redirect=${encodeURIComponent(responseUrl)}`;
  const matchesRecipient =
    user?.email.toLowerCase() === invitation?.email.toLowerCase();

  async function makeDecision(decision: "accept" | "reject") {
    if (!invitation) return;
    setResponseError("");
    setResult("");
    try {
      const response = await respond({
        companyId: invitation.companyId,
        token,
        decision,
      }).unwrap();
      setResult(
        response.status === "accepted"
          ? "The invitation was accepted. Your company is now a party to this contract."
          : "The invitation was rejected.",
      );
      if (response.status === "accepted") {
        router.refresh();
      }
    } catch (error) {
      setResponseError(
        getApiErrorMessage(error, "Your response could not be submitted."),
      );
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-background p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <p className="text-sm font-semibold text-primary">ContractFlow</p>
          <CardTitle>
            <h1 className="mt-2 text-2xl">Company contract invitation</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!token ? (
            <Alert variant="destructive">
              <AlertDescription>
                This invitation link is missing its token.
              </AlertDescription>
            </Alert>
          ) : isLoadingInvitation || isLoadingUser ? (
            <Alert role="status">
              <AlertDescription>Checking invitation…</AlertDescription>
            </Alert>
          ) : invitationError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {getApiErrorMessage(
                  invitationError,
                  "This invitation is invalid, expired, or no longer available.",
                )}
              </AlertDescription>
            </Alert>
          ) : invitation ? (
            <>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">
                    {invitation.invitingCompanyName}
                  </span>{" "}
                  invited <span className="font-medium">{invitation.email}</span>{" "}
                  to join <span className="font-medium">{invitation.contractTitle}</span>{" "}
                  as a {invitation.partyType}.
                </p>
                <p className="text-muted-foreground">
                  A Company Administrator for the invited company must respond.
                  Expires {new Date(invitation.expiresAt).toLocaleString()}.
                </p>
              </div>
              {isSignedOut ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Sign in with the invited company email address. You must be
                    a verified Company Administrator to accept or reject.
                  </p>
                  <Button onClick={() => router.push(loginHref)}>
                    Sign in to respond
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    If you need an account,{" "}
                    <Link
                      className="underline underline-offset-4"
                      href="/auth/register"
                    >
                      create one
                    </Link>{" "}
                    with the invited company email address.
                  </p>
                </div>
              ) : user ? (
                <>
                  {!user.emailVerifiedAt ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Verify your email address before responding.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {!matchesRecipient ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Sign in using the invited address ({invitation.email})
                        to respond.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {responseError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{responseError}</AlertDescription>
                    </Alert>
                  ) : null}
                  {result ? (
                    <Alert role="status">
                      <AlertDescription>{result}</AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      disabled={
                        isLoading ||
                        !matchesRecipient ||
                        !user.emailVerifiedAt ||
                        Boolean(result)
                      }
                      onClick={() => void makeDecision("reject")}
                    >
                      Reject
                    </Button>
                    <Button
                      disabled={
                        isLoading ||
                        !matchesRecipient ||
                        !user.emailVerifiedAt ||
                        Boolean(result)
                      }
                      onClick={() => void makeDecision("accept")}
                    >
                      {isLoading ? "Submitting…" : "Accept invitation"}
                    </Button>
                  </div>
                </>
              ) : (
                <Alert variant="destructive">
                  <AlertDescription>
                    {getApiErrorMessage(
                      userError,
                      "Your session could not be verified.",
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
