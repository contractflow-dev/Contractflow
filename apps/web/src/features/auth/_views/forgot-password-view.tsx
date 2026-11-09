"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiMailLine } from "@remixicon/react";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { FieldGroup } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { FormField } from "@/components/forms/form-field";
import { AuthHero } from "@/components/auth/auth-hero";
import { AuthTopBar } from "@/components/auth/authTopBar";
import { getApiErrorMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { useForgotPasswordMutation } from "@/services/authApi";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "../passwordResetSchema";

/** Shown whatever the address: it never says whether an account exists. */
export const RESET_REQUESTED_MESSAGE =
  "If an account exists for this email address, password reset instructions will be sent.";

export function ForgotPasswordView() {
  const [forgotPassword] = useForgotPasswordMutation();
  const [requested, setRequested] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setServerError(null);
    try {
      await forgotPassword(values).unwrap();
      setRequested(true);
    } catch (error) {
      setServerError(
        getApiErrorMessage(
          error,
          "We couldn’t send password reset instructions right now. Try again in a moment.",
        ),
      );
      setAttempt((count) => count + 1);
    }
  }

  return (
    <main className="grid min-h-svh min-w-0 grid-cols-1 lg:grid-cols-2">
      <section className="flex min-w-0 flex-col p-4 sm:p-6 lg:p-10">
        <AuthTopBar />

        <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-10">
          <div className="w-full min-w-0 max-w-md space-y-6 py-4 sm:py-6">
            {requested ? (
              <div className="space-y-5">
                <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                  <RiMailLine className="size-6" aria-hidden="true" />
                </div>
                <header className="space-y-2">
                  <h1
                    className="type-page-title focus-visible:outline-none"
                    tabIndex={-1}
                    // Announces the new state to screen readers.
                    ref={(element) => element?.focus()}
                  >
                    Check your email
                  </h1>
                  <p role="status" className="text-sm leading-6 text-muted-foreground">
                    {RESET_REQUESTED_MESSAGE} The link works once and expires
                    in 30 minutes. If you don’t see the email, check your spam
                    folder.
                  </p>
                </header>
                <Link
                  href="/login"
                  className={cn(buttonVariants({ size: "xl" }), "w-full")}
                >
                  Back to sign in
                </Link>
              </div>
            ) : (
              <>
                <header className="space-y-2">
                  <h1 className="type-page-title">Forgot your password?</h1>
                  <p className="text-sm text-muted-foreground">
                    Enter the email address you sign in with and we’ll send
                    you a link to choose a new password.
                  </p>
                </header>
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  noValidate
                  aria-label="Request a password reset"
                >
                  <FieldGroup className="gap-4">
                    {serverError ? (
                      <Alert
                        key={attempt}
                        variant="destructive"
                        className="break-words focus-visible:outline-none"
                        tabIndex={-1}
                        ref={(element) => element?.focus()}
                      >
                        <AlertDescription>{serverError}</AlertDescription>
                      </Alert>
                    ) : null}
                    <FormField
                      id="forgot-email"
                      label="Email"
                      error={errors.email?.message}
                    >
                      {(control) => (
                        <Input
                          {...control}
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          spellCheck={false}
                          {...register("email")}
                        />
                      )}
                    </FormField>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      aria-busy={isSubmitting || undefined}
                      size="xl"
                      className="w-full"
                    >
                      {isSubmitting ? "Sending…" : "Send reset link"}
                    </Button>
                  </FieldGroup>
                </form>
                <p className="text-center text-sm text-muted-foreground">
                  Remembered it?{" "}
                  <Link
                    href="/login"
                    className="rounded-md font-medium text-foreground underline underline-offset-4"
                  >
                    Back to sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <AuthHero image="register" />
    </main>
  );
}
