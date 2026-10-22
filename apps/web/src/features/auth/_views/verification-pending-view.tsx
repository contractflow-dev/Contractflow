"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RiMailLine } from "@remixicon/react";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { useResendVerificationEmailMutation } from "@/services/authApi";
import { getApiErrorMessage } from "@/lib/apiError";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { HeroMetrics } from "@/components/auth/HeroMetrics";

export function VerificationPendingView() {
  const [emailInput, setEmailInput] = useState("");
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

    try {
      const response = await resendVerification({
        email: emailInput.trim().toLowerCase(),
      }).unwrap();
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
            <div className="flex items-center justify-between">
              <Link
                href="/auth/register"
                className="text-lg font-semibold tracking-tight"
              >
                ContractFlow
              </Link>
              <ThemeToggle />
            </div>
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <RiMailLine className="size-6" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Check your inbox
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                We sent you a verification link. Open it to verify your email
                address and finish setting up your ContractFlow account. If you
                don’t see it, check your spam folder.
              </p>
            </div>
          </header>

          <form onSubmit={onResend}>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="verification-email">
                  Didn’t receive the email? Send a new link
                </FieldLabel>
                <Input
                  id="verification-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  className="h-11"
                  placeholder="you@company.com"
                  value={emailInput}
                  onChange={(event) => setEmailInput(event.target.value)}
                />
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
                disabled={isLoading || cooldownSeconds > 0 || !emailInput.trim()}
                className="h-11 w-full"
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
      <aside className="relative hidden min-w-0 flex-col justify-between bg-auth-hero bg-cover bg-center p-10 text-white lg:sticky lg:top-0 lg:flex lg:min-h-svh lg:self-start">
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
    </main>
  );
}
