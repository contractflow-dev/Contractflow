"use client";

import {
  cloneElement,
  useEffect,
  useId,
  useState,
  type ReactElement,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegisterMutation } from "@/services/authApi";
import type { RegisterRequest } from "@/services/authApi";
import { getApiErrorMessage } from "@/lib/apiError";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LegalConsent } from "@/components/auth/legal-consent";
import { HeroMetrics } from "@/components/auth/HeroMetrics";

// Mirrors CreateAppUserRequestDto (class-validator) on the API.
const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Email is too long")
      .pipe(z.email("Enter a valid email address")),
    firstName: z.string().trim().min(1, "First name is required").max(100),
    middleName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    phoneNumber: z.string().trim().max(100, "Phone number is too long"),
    timezone: z.string().min(1, "Select a timezone"),
    password: z
      .string()
      .min(12, "Use at least 12 characters")
      .max(255, "Password is too long")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/\d/, "Include a number")
      .regex(/[^A-Za-z0-9]/, "Include a symbol"),
    confirmPassword: z.string(),
    termsAccepted: z.boolean().refine((accepted) => accepted, {
      message: "You must agree to the Terms of Service to create an account.",
    }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type RegisterValues = z.infer<typeof registerSchema>;

const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base outline-none lg:h-10 lg:text-sm transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive disabled:opacity-60";

/** Props Field injects into its (single) control so label, hint and error are wired up. */
type FieldControlProps = {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  /** Exactly one form control (input / select / textarea). */
  children: ReactElement<FieldControlProps>;
}) {
  const id = useId();
  const messageId = `${id}-message`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? messageId : undefined,
      })}
      {error ? (
        <p
          id={messageId}
          role="alert"
          className="break-words text-xs text-destructive"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [registerAccount] = useRegisterMutation();

  const [timezones] = useState<string[]>(() => {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      try {
        return Array.from(new Set(["UTC", ...Intl.supportedValuesOf("timeZone")]));
      } catch {
        return ["UTC"];
      }
    }
    return ["UTC"];
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: {
      email: "",
      firstName: "",
      middleName: "",
      lastName: "",
      phoneNumber: "",
      timezone: "UTC",
      password: "",
      confirmPassword: "",
      termsAccepted: false,
    },
  });

  // Select the browser timezone only after the initial list is ready and
  // fall back to UTC when the detected value isn’t available in the list.
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setValue("timezone", timezones.includes(detected) ? detected : "UTC");
  }, [timezones, setValue]);

  async function onSubmit(values: RegisterValues) {
    setServerError(null);
    const payload: RegisterRequest = {
      email: values.email,
      password: values.password,
      firstName: values.firstName,
      // Optional fields: omit instead of sending "" to the API.
      middleName: values.middleName || undefined,
      lastName: values.lastName,
      phoneNumber: values.phoneNumber || undefined,
      timezone: values.timezone,
    };

    try {
      await registerAccount(payload).unwrap();
      router.push("/auth/verification-pending");
    } catch (error) {
      setServerError(
        getApiErrorMessage(error, "Registration failed. Please try again."),
      );
    }
  }

  return (
    <main className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
      <section className="flex min-w-0 items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full min-w-0 max-w-md space-y-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold tracking-tight">
              ContractFlow
            </span>
            <ThemeToggle />
          </div>

          <header className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Create your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Get started with ContractFlow in a minute.
            </p>
          </header>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            {serverError && (
              <div
                role="alert"
                className="break-words rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {serverError}
              </div>
            )}

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="First name" error={errors.firstName?.message}>
                <input
                  className={inputClass}
                  autoComplete="given-name"
                  {...register("firstName")}
                />
              </Field>
              <Field label="Last name" error={errors.lastName?.message}>
                <input
                  className={inputClass}
                  autoComplete="family-name"
                  {...register("lastName")}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label="Middle name (optional)"
                  error={errors.middleName?.message}
                >
                  <input
                    className={inputClass}
                    autoComplete="additional-name"
                    {...register("middleName")}
                  />
                </Field>
              </div>
            </div>

            <Field label="Email" error={errors.email?.message}>
              <input
                type="email"
                className={inputClass}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                {...register("email")}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Phone number"
                error={errors.phoneNumber?.message}
              >
                <input
                  type="tel"
                  className={inputClass}
                  autoComplete="tel"
                  {...register("phoneNumber")}
                />
              </Field>
              <Field label="Timezone" error={errors.timezone?.message}>
                <select className={inputClass} {...register("timezone")}>
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field
              label="Password"
              error={errors.password?.message}
              hint="12+ characters with upper, lower, number and symbol."
            >
              <input
                type="password"
                className={inputClass}
                autoComplete="new-password"
                {...register("password", {
                  // Re-check the confirm field when the password changes, but
                  // only if the user has already typed something there.
                  onChange: () => {
                    if (getValues("confirmPassword")) {
                      void trigger("confirmPassword");
                    }
                  },
                })}
              />
            </Field>

            <Field
              label="Confirm password"
              error={errors.confirmPassword?.message}
            >
              <input
                type="password"
                className={inputClass}
                autoComplete="new-password"
                {...register("confirmPassword")}
              />
            </Field>

            <Controller
              control={control}
              name="termsAccepted"
              render={({ field, fieldState }) => (
                <LegalConsent
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  error={fieldState.error?.message}
                />
              )}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded-md bg-primary text-sm font-medium lg:h-10 text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {isSubmitting ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
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
          <HeroMetrics className="mt-8 gap-4 xl:mt-12 xl:gap-8" />
          <p className="text-xs text-white/70">
            &copy; {new Date().getFullYear()} ContractFlow
          </p>
        </div>
      </aside>
    </main>
  );
}
