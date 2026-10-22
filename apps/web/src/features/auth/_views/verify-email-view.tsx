"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { buttonVariants } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@/lib/utils";
import { useVerifyEmailMutation } from "@/services/authApi";
import { getApiErrorMessage } from "@/lib/apiError";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { HeroMetrics } from "@/components/auth/HeroMetrics";

const LINK_BUTTON_CLASS = "h-auto min-h-11 w-full whitespace-normal py-2 text-center";

type VerificationState = "verifying" | "verified" | "failed";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [token] = useState(() => searchParams.get("token")); // captured once
  const [state, setState] = useState<VerificationState>(
    token ? "verifying" : "failed",
  );
  // ...rest unchanged
  const [message, setMessage] = useState<string | null>(null);
  const [verifyEmail] = useVerifyEmailMutation();
  const started = useRef(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    if (started.current) return;
    started.current = true;

    void verifyEmail({ token })
      .unwrap()
      .then((response) => {
        window.history.replaceState({}, "", "/auth/verify-email");
        setMessage(response.message ?? "Your email address is verified.");
        setState("verified");
      })
      .catch((error: unknown) => {
        window.history.replaceState({}, "", "/auth/verify-email");
        setMessage(
          getApiErrorMessage(
            error,
            "Unable to verify this link. It may be invalid, expired, or the service may be temporarily unavailable.",
          ),
        );
        setState("failed");
      });
  }, [token, verifyEmail]);

  return (
    <main className="grid min-h-svh min-w-0 grid-cols-1 lg:grid-cols-2">
      <aside className="relative hidden min-w-0 flex-col justify-between overflow-hidden bg-auth-hero bg-cover bg-center p-10 text-white lg:sticky lg:top-0 lg:flex lg:min-h-svh lg:self-start">
        <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

        <span className="relative z-10 text-lg font-semibold tracking-tight">
          ContractFlow
        </span>

        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold leading-tight">
              Every contract, from tender to close-out, in one place.
            </h2>
            <p className="max-w-md text-sm text-white/80">
              Track vendors, approvals, milestones and obligations across your
              oil and gas operations.
            </p>
          </div>
          <HeroMetrics className="mt-4 gap-8 xl:mt-2 xl:gap-1" />
          <p className="text-xs text-white/70">
            &copy; {new Date().getFullYear()} ContractFlow
          </p>
        </div>
      </aside>
      <section className="flex min-w-0 items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full min-w-0 max-w-md space-y-6 py-4 sm:py-6">
          <header className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-primary">ContractFlow</p>
              <ThemeToggle />
            </div>
            {state === "verifying" ? (
              <>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Verifying your email
                </h1>
                <p role="status" className="text-sm text-muted-foreground">
                  Please wait while we confirm the link with the server.
                </p>
              </>
            ) : !token ? (
              <>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Verification link is incomplete
                </h1>
                <Alert variant="destructive" className="break-words">
                  <AlertDescription>
                    Open the complete verification link from your email.
                  </AlertDescription>
                </Alert>
                <Link
                  href="/auth/verification-pending"
                  className={cn(buttonVariants({ variant: "outline" }), LINK_BUTTON_CLASS)}
                >
                  Request another verification email
                </Link>
              </>
            ) : state === "verified" ? (
              <>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Email verified
                </h1>
                <p role="status" className="text-sm text-muted-foreground">
                  {message}
                </p>
                <Link
                  href="/login"
                  className={cn(buttonVariants(), LINK_BUTTON_CLASS)}
                >
                  Continue to sign in
                </Link>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-semibold tracking-tight">
                  We couldn’t verify this link
                </h1>
                <Alert variant="destructive" className="break-words">
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
                <Link
                  href="/auth/verification-pending"
                  className={cn(buttonVariants({ variant: "outline" }), LINK_BUTTON_CLASS)}
                >
                  Request another verification email
                </Link>
              </>
            )}
          </header>
        </div>
      </section>
    </main>
  );
}

export function VerifyEmailView() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-svh min-w-0 place-items-center bg-muted/30 p-4 sm:p-6">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-4 w-48" aria-hidden="true" />
            <p role="status" className="text-sm text-muted-foreground">
              Loading verification link…
            </p>
          </div>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
