"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { buttonVariants } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { AuthTopBar } from "@/components/auth/authTopBar";
import { getApiErrorMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { useVerifyCompanyEmailMutation } from "@/services/companiesApi";

const PAGE_PATH = "/auth/verify-company";
const LINK_BUTTON_CLASS =
  "h-auto min-h-11 w-full whitespace-normal py-2 text-center";

type VerificationState = "verifying" | "verified" | "failed";

function VerifyCompanyEmailContent() {
  const searchParams = useSearchParams();
  const [token] = useState(() => searchParams.get("token")); // captured once
  const [state, setState] = useState<VerificationState>(
    token ? "verifying" : "failed",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [verifyCompanyEmail] = useVerifyCompanyEmailMutation();
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    void verifyCompanyEmail({ token })
      .unwrap()
      .then((response) => {
        // Drop the one-time token from the address bar and history.
        window.history.replaceState({}, "", PAGE_PATH);
        setMessage(
          `${response.companyName} can now be invited to other companies' contracts.`,
        );
        setState("verified");
      })
      .catch((error: unknown) => {
        window.history.replaceState({}, "", PAGE_PATH);
        setMessage(
          getApiErrorMessage(
            error,
            "Unable to verify this link. It may be invalid or expired, or the service may be temporarily unavailable.",
          ),
        );
        setState("failed");
      });
  }, [token, verifyCompanyEmail]);

  return (
    <main className="flex min-h-svh min-w-0 flex-col p-4 sm:p-6 lg:p-10">
      <AuthTopBar />
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full min-w-0 max-w-md space-y-5 py-4 sm:py-6">
          {state === "verifying" ? (
            <>
              <h1 className="type-page-title">
                Verifying your company email
              </h1>
              <p role="status" className="text-sm text-muted-foreground">
                This only takes a moment.
              </p>
            </>
          ) : state === "verified" ? (
            <>
              <h1 className="type-page-title">
                Company email verified
              </h1>
              <p role="status" className="text-sm text-muted-foreground">
                {message}
              </p>
              <Link
                href="/dashboards"
                className={cn(buttonVariants(), LINK_BUTTON_CLASS)}
              >
                Go to your workspace
              </Link>
            </>
          ) : (
            <>
              <h1 className="type-page-title">
                {token
                  ? "We couldn’t verify this link"
                  : "Verification link is incomplete"}
              </h1>
              <Alert variant="destructive" role="alert" className="break-words">
                <AlertDescription>
                  {token
                    ? message
                    : "Open the complete verification link from the company email."}
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">
                A company administrator can send a new link from the company
                overview.
              </p>
              <Link
                href="/dashboards"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  LINK_BUTTON_CLASS,
                )}
              >
                Go to your workspace
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export function VerifyCompanyEmailView() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-svh min-w-0 place-items-center p-4 sm:p-6">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-4 w-48" aria-hidden="true" />
            <p role="status" className="text-sm text-muted-foreground">
              Loading verification link…
            </p>
          </div>
        </main>
      }
    >
      <VerifyCompanyEmailContent />
    </Suspense>
  );
}
