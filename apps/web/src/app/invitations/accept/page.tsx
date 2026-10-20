"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
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
        <p role="alert" className="rounded-lg border p-5 text-sm">
          This invitation link is incomplete.
        </p>
      </main>
    );
  }

  const unauthenticated =
    getApiErrorStatus(userError) === 401 ||
    getApiErrorStatus(userError) === 403;

  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-4">
      <section className="w-full max-w-lg space-y-5 rounded-xl border bg-background p-6 shadow-sm sm:p-8">
        <header className="space-y-2">
          <p className="text-sm font-semibold text-primary">ContractFlow</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Company invitation
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in with the verified email address that received this
            invitation. Acceptance creates company membership only; contract
            workspace access is assigned separately.
          </p>
        </header>
        {isFetching ? (
          <p role="status" className="text-sm text-muted-foreground">
            Checking your session…
          </p>
        ) : unauthenticated || !user ? (
          <div className="space-y-3">
            {userError && !unauthenticated && (
              <p role="alert" className="text-sm text-destructive">
                {getApiErrorMessage(userError, "Unable to check your session.")}
              </p>
            )}
            <Link
              href={`/login?invitationToken=${encodeURIComponent(token)}`}
              className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Sign in to continue
            </Link>
            <p className="text-xs text-muted-foreground">
              If you do not have an account yet, register and verify this email,
              then reopen the invitation link.
            </p>
          </div>
        ) : feedback ? (
          <div className="space-y-3">
            <p role="status" className="text-sm">{feedback}</p>
            <Link
              href="/dashboards"
              className="inline-flex min-h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
            >
              Go to dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {failure && (
              <p role="alert" className="text-sm text-destructive">
                {failure}
              </p>
            )}
            <p className="text-sm">
              Signed in as <strong>{user.email}</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void accept()}
                className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {busy && pending === "accept" ? "Accepting…" : "Accept invitation"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void decline()}
                className="min-h-10 rounded-md border px-4 text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                {busy && pending === "decline" ? "Declining…" : "Decline"}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-svh place-items-center p-6">
          <p role="status" className="text-sm text-muted-foreground">
            Loading invitation…
          </p>
        </main>
      }
    >
      <InvitationContent />
    </Suspense>
  );
}
