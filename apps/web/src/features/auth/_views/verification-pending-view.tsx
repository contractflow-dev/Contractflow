"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { RiMailLine } from "@remixicon/react";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { useResendVerificationEmailMutation } from "@/services/authApi";
import { getApiErrorMessage } from "@/lib/apiError";
import { AuthTopBar } from "@/components/auth/authTopBar";
import { AuthHero } from "@/components/auth/auth-hero";
import {
  maskEmail,
  readPendingVerificationEmail,
  rememberPendingVerificationEmail,
} from "../pendingVerificationEmail";

// sessionStorage doesn't announce changes made in this tab; the address is
// read once per render, and the server render has none.
function subscribeToPendingEmail() {
  return () => {};
}

export function VerificationPendingView() {
  const pendingEmail = useSyncExternalStore(
    subscribeToPendingEmail,
    readPendingVerificationEmail,
    () => null,
  );
  // null until the user edits the field: until then it shows the address
  // the link was sent to.
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const emailInput = typedEmail ?? pendingEmail ?? "";
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [resendVerification, { isLoading }] =
    useResendVerificationEmailMutation();

  useEffect(() => {
    if (cooldownSeconds === 0) return;
    const timer = window.setInterval(
      () => setCooldownSeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  async function onResend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cooldownSeconds > 0 || isLoading) return;
    setMessage(null);
    setErrorMessage(null);

    const email = emailInput.trim().toLowerCase();
    try {
      const response = await resendVerification({ email }).unwrap();
      rememberPendingVerificationEmail(email);
      setMessage(
        response.message ??
          "If an account needs verification, a new link will be sent.",
      );
      setCooldownSeconds(60);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "Unable to resend the verification email."),
      );
    }
  }

  return (
    <main className="grid min-h-svh min-w-0 grid-cols-1 lg:grid-cols-2">
      <section className="flex min-w-0 items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full min-w-0 max-w-md space-y-6 py-4 sm:py-6">
          <header className="space-y-5">
            <AuthTopBar />
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <RiMailLine className="size-6" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h1 className="type-page-title">Check your inbox</h1>
              <p className="text-sm leading-6 text-muted-foreground">
                {pendingEmail ? (
                  <>
                    We sent a verification link to{" "}
                    <span className="font-medium text-foreground">
                      {maskEmail(pendingEmail)}
                    </span>
                    .
                  </>
                ) : (
                  "We sent you a verification link."
                )}{" "}
                Open it to verify your email address and finish setting up your
                ContractFlow account. If you don’t see it, check your spam
                folder.
              </p>
            </div>
          </header>

          <form onSubmit={onResend}>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="verification-email">
                  Didn’t receive the email? Send a new link
                </FieldLabel>
                {/* <Input
                  id="verification-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="you@company.com"
                  value={emailInput}
                  onChange={(event) => setTypedEmail(event.target.value)}
                /> */}
              </Field>

              {message && (
                <Alert role="status">
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}
              {errorMessage && (
                <Alert variant="destructive" className="break-words">
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={
                  isLoading || cooldownSeconds > 0 || !emailInput.trim()
                }
                size="xl"
                className="w-full"
              >
                {isLoading
                  ? "Sending…"
                  : cooldownSeconds > 0
                    ? `Resend available in ${cooldownSeconds}s`
                    : "Resend verification email"}
              </Button>
            </FieldGroup>
          </form>

          <p className="text-sm text-muted-foreground">
            Already verified?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </div>
      </section>
      <AuthHero />
    </main>
  );
}
