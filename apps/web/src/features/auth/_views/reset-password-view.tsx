"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { FieldGroup } from "@workspace/ui/components/field";
import { FormField } from "@/components/forms/form-field";
import { AuthHero } from "@/components/auth/auth-hero";
import { AuthTopBar } from "@/components/auth/authTopBar";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { useResetPasswordMutation } from "@/services/authApi";
import { PasswordInput } from "../components/password-input";
import {
  RESET_LINK_INVALID_MESSAGE,
  resetPasswordSchema,
  type ResetPasswordValues,
} from "../passwordResetSchema";
import { NEW_PASSWORD_RULES } from "../registerSchema";

export const RESET_PASSWORD_PATH = "/auth/reset-password";

type Outcome = "form" | "invalid" | "done";

/** Focuses a heading as it appears, so the new state is announced. */
function focusOnMount(element: HTMLElement | null) {
  element?.focus();
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  // Read once; it lives only in this component's memory from here on.
  const [token] = useState(() => searchParams.get("token"));
  const [outcome, setOutcome] = useState<Outcome>("form");
  const [serverError, setServerError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [resetPassword] = useResetPasswordMutation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // Take the token out of the address bar (and so out of history, bookmarks
  // and anything that reads the URL) as soon as the page loads.
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(null, "", RESET_PASSWORD_PATH);
    }
  }, []);

  async function onSubmit(values: ResetPasswordValues) {
    if (!token) return;
    setServerError(null);
    try {
      await resetPassword({ token, password: values.password }).unwrap();
      setOutcome("done");
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        "We couldn’t reset your password right now. Try again in a moment.",
      );
      if (
        getApiErrorStatus(error) === 400 &&
        message === RESET_LINK_INVALID_MESSAGE
      ) {
        setOutcome("invalid");
        return;
      }
      setServerError(message);
      setAttempt((count) => count + 1);
    }
  }

  return (
    <main className="grid min-h-svh min-w-0 grid-cols-1 lg:grid-cols-2">
      <section className="flex min-w-0 flex-col p-4 sm:p-6 lg:p-10">
        <AuthTopBar />

        <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-10">
          <div className="w-full min-w-0 max-w-md space-y-6 py-4 sm:py-6">
            {!token ? (
              <div className="space-y-5">
                <header className="space-y-2">
                  <h1 className="type-page-title">Reset link is incomplete</h1>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Open the complete link from your password reset email, or
                    ask for a new one.
                  </p>
                </header>
                <Link
                  href="/auth/forgot-password"
                  className={cn(buttonVariants({ size: "xl" }), "w-full")}
                >
                  Request a new link
                </Link>
                <BackToSignIn />
              </div>
            ) : outcome === "invalid" ? (
              <div className="space-y-5">
                <header className="space-y-2">
                  <h1
                    ref={focusOnMount}
                    tabIndex={-1}
                    className="type-page-title focus-visible:outline-none"
                  >
                    This reset link can’t be used
                  </h1>
                  <Alert variant="destructive" className="break-words">
                    <AlertDescription>
                      It has expired, has already been used, or a newer link
                      replaced it. Ask for a new link to reset your password.
                    </AlertDescription>
                  </Alert>
                </header>
                <Link
                  href="/auth/forgot-password"
                  className={cn(buttonVariants({ size: "xl" }), "w-full")}
                >
                  Request a new link
                </Link>
                <BackToSignIn />
              </div>
            ) : outcome === "done" ? (
              <div className="space-y-5">
                <header className="space-y-2">
                  <h1
                    ref={focusOnMount}
                    tabIndex={-1}
                    className="type-page-title focus-visible:outline-none"
                  >
                    Password reset
                  </h1>
                  <p role="status" className="text-sm leading-6 text-muted-foreground">
                    Your password has been changed and you’ve been signed out
                    on every device. Sign in with your new password.
                  </p>
                </header>
                <Link
                  href="/login"
                  className={cn(buttonVariants({ size: "xl" }), "w-full")}
                >
                  Sign in
                </Link>
              </div>
            ) : (
              <>
                <header className="space-y-2">
                  <h1 className="type-page-title">Choose a new password</h1>
                  <p className="text-sm text-muted-foreground">
                    After you reset it, you’ll be signed out everywhere and
                    can sign in with the new password.
                  </p>
                </header>
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  noValidate
                  aria-label="Choose a new password"
                >
                  <FieldGroup className="gap-4">
                    {serverError ? (
                      <Alert
                        key={attempt}
                        variant="destructive"
                        className="break-words focus-visible:outline-none"
                        tabIndex={-1}
                        ref={focusOnMount}
                      >
                        <AlertDescription>{serverError}</AlertDescription>
                      </Alert>
                    ) : null}
                    <FormField
                      id="reset-password"
                      label="New password"
                      description={NEW_PASSWORD_RULES}
                      error={errors.password?.message}
                    >
                      {(control) => (
                        <PasswordInput
                          {...control}
                          autoComplete="new-password"
                          {...register("password")}
                        />
                      )}
                    </FormField>
                    <FormField
                      id="reset-confirm-password"
                      label="Confirm new password"
                      error={errors.confirmPassword?.message}
                    >
                      {(control) => (
                        <PasswordInput
                          {...control}
                          autoComplete="new-password"
                          {...register("confirmPassword")}
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
                      {isSubmitting ? "Resetting…" : "Reset password"}
                    </Button>
                  </FieldGroup>
                </form>
                <BackToSignIn />
              </>
            )}
          </div>
        </div>
      </section>

      <AuthHero image="register" />
    </main>
  );
}

function BackToSignIn() {
  return (
    <p className="text-center text-sm text-muted-foreground">
      <Link
        href="/login"
        className="rounded-md font-medium text-foreground underline underline-offset-4"
      >
        Back to sign in
      </Link>
    </p>
  );
}

export function ResetPasswordView() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-svh place-items-center p-6">
          <p role="status" className="text-sm text-muted-foreground">
            Loading…
          </p>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
