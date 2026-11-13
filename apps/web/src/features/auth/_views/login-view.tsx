"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { FieldGroup } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { FormField } from "@/components/forms/form-field";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { useLoginMutation } from "@/services/authApi";
import { AuthHero } from "@/components/auth/auth-hero";
import { AuthTopBar } from "@/components/auth/authTopBar";
import { PasswordInput } from "../components/password-input";
import {
  forgetPendingVerificationEmail,
  rememberPendingVerificationEmail,
} from "../pendingVerificationEmail";
import {
  SESSION_EXPIRED_REASON,
  invitationTokenFromRedirect,
  safeRedirectPath,
} from "../signInRedirect";
import { invitationRegisterPath } from "@/features/invitations/joinedCompany";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Enter your password"),
});
type LoginValues = z.infer<typeof loginSchema>;

/**
 * The API's answer to a correct password on an unverified account. It is
 * given only after the password matches, so it reveals nothing to someone
 * guessing addresses.
 */
export const UNVERIFIED_LOGIN_MESSAGE = "Verify your email before signing in.";

type ServerError = { kind: "unverified" } | { kind: "other"; message: string };

export function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [login] = useLoginMutation();
  const [serverError, setServerError] = useState<ServerError | null>(null);
  // Remounts the error on each failed attempt, so focus moves to it again.
  const [attempt, setAttempt] = useState(0);
  const logoutWarning = searchParams.get("logout") === "failed";
  const sessionExpired = searchParams.get("reason") === SESSION_EXPIRED_REASON;
  const signInToContinue =
    !sessionExpired && Boolean(searchParams.get("redirect"));
  const invitationToken = invitationTokenFromRedirect(
    searchParams.get("redirect"),
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setServerError(null);
    try {
      await login(values).unwrap();
      forgetPendingVerificationEmail();
      router.replace(
        safeRedirectPath(searchParams.get("redirect"), window.location.origin),
      );
    } catch (error) {
      const message = getApiErrorMessage(error, "Sign in failed.");
      if (
        getApiErrorStatus(error) === 401 &&
        message === UNVERIFIED_LOGIN_MESSAGE
      ) {
        rememberPendingVerificationEmail(values.email);
        setServerError({ kind: "unverified" });
      } else {
        setServerError({ kind: "other", message });
      }
      setAttempt((count) => count + 1);
    }
  }

  return (
    <main className="grid min-h-svh min-w-0 grid-cols-1 lg:grid-cols-2">
      <section className="flex min-w-0 flex-col p-4 sm:p-6 lg:p-10">
        {/* Pinned to the top of the page while the content scrolls */}
        <AuthTopBar />

        <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-10">
          <div className="w-full min-w-0 max-w-md space-y-6 py-4 sm:py-6">
            <header className="space-y-2">
              <h1 className="type-page-title">Welcome back</h1>
              {/* <p className="text-sm text-muted-foreground">
                Sign in to continue to your company workspace.
              </p> */}
            </header>
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              aria-label="Sign in"
            >
              <FieldGroup className="gap-4">
                {sessionExpired ? (
                  <Alert role="status">
                    <AlertDescription>
                      Your session has expired. Sign in again to continue where
                      you left off.
                    </AlertDescription>
                  </Alert>
                ) : invitationToken ? (
                  <Alert role="status">
                    <AlertDescription>
                      Sign in with the invited email address to respond to your
                      company invitation.
                    </AlertDescription>
                  </Alert>
                ) : signInToContinue ? (
                  <Alert role="status">
                    <AlertDescription>
                      Sign in to continue to that page.
                    </AlertDescription>
                  </Alert>
                ) : null}
                {serverError ? (
                  <Alert
                    key={attempt}
                    variant="destructive"
                    className="break-words focus-visible:outline-none"
                    tabIndex={-1}
                    // Moves focus to the message, so it is read out and the
                    // next Tab continues from the form.
                    ref={(element) => element?.focus()}
                  >
                    <AlertDescription>
                      {serverError.kind === "unverified" ? (
                        <>
                          Verify your email address before signing in. Open the
                          link we sent you, or{" "}
                          <Link
                            href="/auth/verification-pending"
                            className="font-medium text-foreground underline underline-offset-4"
                          >
                            send a new verification email
                          </Link>
                          .
                        </>
                      ) : (
                        serverError.message
                      )}
                    </AlertDescription>
                  </Alert>
                ) : null}
                {logoutWarning && (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>
                      We couldn’t confirm sign out with the server. Your local
                      session was cleared, but the server may not have revoked
                      it. Please sign in again, and retry sign out if needed.
                    </AlertDescription>
                  </Alert>
                )}
                <FormField
                  id="login-email"
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
                <FormField
                  id="login-password"
                  label="Password"
                  error={errors.password?.message}
                >
                  {(control) => (
                    <PasswordInput
                      {...control}
                      autoComplete="current-password"
                      {...register("password")}
                    />
                  )}
                </FormField>
                <p className="-mt-1 text-end text-sm">
                  <Link
                    href="/auth/forgot-password"
                    className="rounded-md font-medium text-foreground underline underline-offset-4"
                  >
                    Forgot your password?
                  </Link>
                </p>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting || undefined}
                  size="xl"
                  className="w-full"
                >
                  {isSubmitting ? "Signing in…" : "Sign in"}
                </Button>
              </FieldGroup>
            </form>
            <p className="text-center text-sm text-muted-foreground">
              New to ContractFlow?{" "}
              <Link
                href={
                  invitationToken
                    ? invitationRegisterPath(invitationToken)
                    : "/auth/register"
                }
                className="rounded-md font-medium text-foreground underline underline-offset-4"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </section>

      <AuthHero image="register" />
    </main>
  );
}
