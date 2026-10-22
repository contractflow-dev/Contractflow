"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { getApiErrorMessage } from "@/lib/apiError";
import { useLoginMutation } from "@/services/authApi";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { HeroMetrics } from "@/components/auth/HeroMetrics";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1, "Enter your password"),
});
type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [login] = useLoginMutation();
  const [serverError, setServerError] = useState<string | null>(null);
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
      const requestedRedirect = new URLSearchParams(window.location.search).get(
        "redirect",
      );
      const redirectUrl = requestedRedirect
        ? new URL(requestedRedirect, window.location.origin)
        : null;
      const safeRedirect =
        requestedRedirect?.startsWith("/") &&
        redirectUrl?.origin === window.location.origin
          ? `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`
          : "/dashboards";
      router.replace(safeRedirect);
    } catch (error) {
      setServerError(getApiErrorMessage(error, "Sign in failed."));
    }
  }

  return (
    <main className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
      <section className="flex min-w-0 items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full min-w-0 max-w-md space-y-6 py-4 sm:py-6">
          <header className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-primary">ContractFlow</p>
              <ThemeToggle />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to continue to your company workspace.
            </p>
          </header>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FieldGroup className="gap-4">
              {serverError && (
                <Alert variant="destructive" className="break-words">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  className="h-11 rounded-md"
                  {...register("email")}
                />
                {errors.email && (
                  <FieldError className="break-words text-xs">
                    {errors.email.message}
                  </FieldError>
                )}
              </Field>
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="login-password">Password</FieldLabel>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  className="h-11 rounded-md"
                  {...register("password")}
                />
                {errors.password && (
                  <FieldError className="break-words text-xs">
                    {errors.password.message}
                  </FieldError>
                )}
              </Field>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full rounded-md"
              >
                {isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
            </FieldGroup>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            New to ContractFlow?{" "}
            <Link
              href="/auth/register"
              className="font-medium text-foreground underline underline-offset-4 rounded-md"
            >
              Create an account
            </Link>
          </p>
        </div>
      </section>
      <aside className="relative hidden min-w-0 flex-col justify-between bg-reg-hero bg-cover bg-center p-10 text-white lg:sticky lg:top-0 lg:flex lg:min-h-svh lg:self-start">
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

        {/* Top */}
        <span className="relative z-10 text-lg font-semibold tracking-tight">
          {" "}
        </span>

        {/* Bottom */}
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
