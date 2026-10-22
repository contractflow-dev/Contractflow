"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@/lib/utils";
import { useRespondToCompanyInvitationMutation } from "@/features/companies/companiesApi";
import { useGetCurrentUserQuery } from "@/services/authApi";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";

function InvitationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { data: user, error: userError, isFetching } = useGetCurrentUserQuery();
  const [respond, respondState] = useRespondToCompanyInvitationMutation();
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const busy = respondState.isLoading;

  async function submit(decision: "accept" | "decline") {
    if (!token) return;
    setFailure(null);
    setFeedback(null);
    setPending(decision);
    try {
      const result = await respond({ token, decision }).unwrap();
      window.history.replaceState({}, "", "/invitations/accept");
      setFeedback(
        result.status === "accepted"
          ? "Invitation accepted. You are now a company member."
          : result.status === "declined"
            ? "Invitation declined."
            : "This invitation has expired. Ask an administrator for a new one.",
      );
    } catch (error) {
      setFailure(
        getApiErrorMessage(error, "Unable to respond to this invitation."),
      );
    } finally {
      setPending(null);
    }
  }

  const accept = () => submit("accept");
  const decline = () => submit("decline");

  if (!token) {
    return (
      <main className="mx-auto grid min-h-svh max-w-xl place-items-center p-6">
        <Alert variant="destructive">
          <AlertDescription>
            This invitation link is incomplete.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const unauthenticated =
    getApiErrorStatus(userError) === 401 ||
    getApiErrorStatus(userError) === 403;

  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <p className="text-sm font-semibold text-primary">ContractFlow</p>
          <CardTitle role="heading" aria-level={1} className="text-2xl font-semibold tracking-tight">
            Company invitation
          </CardTitle>
          <CardDescription>
            Sign in with the verified email address that received this
            invitation. Acceptance creates company membership only; contract
            workspace access is assigned separately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isFetching ? (
            <div role="status" className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <p className="text-sm text-muted-foreground">
                Checking your session…
              </p>
            </div>
          ) : unauthenticated || !user ? (
            <div className="space-y-3">
              {userError && !unauthenticated && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {getApiErrorMessage(
                      userError,
                      "Unable to check your session.",
                    )}
                  </AlertDescription>
                </Alert>
              )}
              <Link
                href={`/login?invitationToken=${encodeURIComponent(token)}`}
                className={cn(buttonVariants({ size: "lg" }), "w-full")}
              >
                Sign in to continue
              </Link>
              <p className="text-xs text-muted-foreground">
                If you do not have an account yet, register and verify this
                email, then reopen the invitation link.
              </p>
            </div>
          ) : feedback ? (
            <div className="space-y-3">
              <p role="status" className="text-sm">{feedback}</p>
              <Link
                href="/dashboards"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Go to dashboard
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {failure && (
                <Alert variant="destructive">
                  <AlertDescription>{failure}</AlertDescription>
                </Alert>
              )}
              <p className="text-sm">
                Signed in as <strong>{user.email}</strong>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="lg"
                  disabled={busy}
                  onClick={() => void accept()}
                >
                  {busy && pending === "accept"
                    ? "Accepting…"
                    : "Accept invitation"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={busy}
                  onClick={() => void decline()}
                >
                  {busy && pending === "decline" ? "Declining…" : "Decline"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-svh place-items-center p-6">
          <div role="status" className="flex flex-col items-center gap-3">
            <Skeleton className="h-4 w-40" />
            <p className="text-sm text-muted-foreground">Loading invitation…</p>
          </div>
        </main>
      }
    >
      <InvitationContent />
    </Suspense>
  );
}
