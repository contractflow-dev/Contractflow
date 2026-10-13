"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getApiErrorMessage } from "@/lib/apiError";
import { useLoginMutation } from "@/services/authApi";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { HeroMetrics } from "@/components/auth/HeroMetrics";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1, "Enter your password"),
});
type LoginValues = z.infer<typeof loginSchema>;

const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive disabled:opacity-60";

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
      router.replace("/dashboards");
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
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            {serverError && (
              <p
                role="alert"
                className="break-words rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {serverError}
              </p>
            )}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                className={inputClass}
                {...register("email")}
              />
              {errors.email && (
                <p
                  role="alert"
                  className="break-words text-xs text-destructive"
                >
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-sm font-medium">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                className={inputClass}
                {...register("password")}
              />
              {errors.password && (
                <p
                  role="alert"
                  className="break-words text-xs text-destructive"
                >
                  {errors.password.message}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            New to ContractFlow?{" "}
            <Link
              href="/auth/register"
              className="font-medium text-foreground underline underline-offset-4"
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
