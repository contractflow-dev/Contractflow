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
import {
  useGetPublicContractRoleInvitationQuery,
  useRespondToContractRoleInvitationMutation,
} from "@/services/contractApi";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { useGetCurrentUserQuery } from "@/services/authApi";

export function ContractRoleInvitationResponse({ token }: { token: string }) {
  const router = useRouter();
  const [result, setResult] = useState("");
  const [responseError, setResponseError] = useState("");
  const {
    currentData: invitation,
    error: invitationError,
    isLoading: isLoadingInvitation,
  } = useGetPublicContractRoleInvitationQuery({ token }, { skip: !token });
  const {
    data: user,
    error: userError,
    isLoading: isLoadingUser,
  } = useGetCurrentUserQuery(undefined, { refetchOnMountOrArgChange: true });
  const [respond, { isLoading }] = useRespondToContractRoleInvitationMutation();
  const isSignedOut = getApiErrorStatus(userError) === 401;
  const responseUrl = `/invitations/contract-role?token=${encodeURIComponent(token)}`;
  const loginHref = `/login?redirect=${encodeURIComponent(responseUrl)}`;
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
        setResult("You declined this contract role invitation.");
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
            <h1 className="mt-2 text-2xl">Contract role invitation</h1>
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
                  <span className="font-medium">{invitation.companyName}</span>{" "}
                  invited{" "}
                  <span className="font-medium">{invitation.email}</span> to the{" "}
                  <span className="font-medium">
                    {invitation.contractTitle}
                  </span>{" "}
                  {invitation.workspace} workspace as{" "}
                  <span className="font-medium">{invitation.role}</span>
                  {invitation.isWorkspaceAdmin
                    ? " with Workspace Admin privileges"
                    : ""}
                  .
                </p>
                <p className="text-muted-foreground">
                  Expires {new Date(invitation.expiresAt).toLocaleString()}.
                </p>
              </div>
              {isSignedOut ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Sign in using the invited email address to accept or
                    decline. You must be an active member of the company to
                    accept this contract role.
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
                    using this email, verify it, and reopen this link.
                  </p>
                </div>
              ) : user ? (
                <>
                  {!user.emailVerifiedAt ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Verify your email address before responding to this
                        invitation.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {!matchesRecipient ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        You are signed in as {user.email}. Sign in with the
                        invited address to respond.
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
