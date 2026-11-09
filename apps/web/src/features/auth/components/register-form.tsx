"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  RiArrowRightLine,
  RiGlobalLine,
  RiMailLine,
  RiPhoneLine,
} from "@remixicon/react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { FieldError, FieldGroup } from "@workspace/ui/components/field";
import {
  FormField,
  FormSection,
  RequiredFieldsNote,
} from "@/components/forms/form-field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

import { LegalConsent } from "@/components/auth/legal-consent";
import { registerSchema, type RegisterValues } from "../registerSchema";
import { rememberPendingVerificationEmail } from "../pendingVerificationEmail";
import { PasswordInput } from "./password-input";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { useRegisterMutation } from "@/services/authApi";
import type { RegisterRequest } from "@/services/authApi";

const nameFields = [
  {
    name: "firstName",
    label: "First name",
    required: true,
    autoComplete: "given-name",
  },
  {
    name: "middleName",
    label: "Middle name",
    required: false,
    autoComplete: "additional-name",
  },
  {
    name: "lastName",
    label: "Last name",
    required: true,
    autoComplete: "family-name",
  },
] as const;

// The server and browser can support different time zones, so the server
// renders only UTC and the browser swaps in its own list after hydration.
const serverTimezones = ["UTC"];
let browserTimezones: string[] | null = null;

function getBrowserTimezones() {
  if (!browserTimezones) {
    const supported =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [];
    browserTimezones = [
      "UTC",
      ...supported.filter((timezone) => timezone !== "UTC"),
    ];
  }
  return browserTimezones;
}

function subscribeToTimezones() {
  return () => {};
}

export function RegisterForm() {
  const router = useRouter();
  const [registerUser] = useRegisterMutation();

  const timezones = useSyncExternalStore(
    subscribeToTimezones,
    getBrowserTimezones,
    () => serverTimezones,
  );

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      phone: "",
      timezone: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const { getValues, setValue } = form;

  useEffect(() => {
    if (!getValues("timezone")) {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Effects run only in the browser, so check against the browser's full
      // list; `timezones` is still the server list during hydration.
      setValue(
        "timezone",
        getBrowserTimezones().includes(detectedTimezone)
          ? detectedTimezone
          : "UTC",
      );
    }
  }, [getValues, setValue]);

  function applyServerError(err: unknown) {
    if (getApiErrorStatus(err) === 409) {
      form.setError("email", {
        type: "server",
        message: "An account with this email already exists.",
      });
      return;
    }

    form.setError("root.server", {
      message: getApiErrorMessage(
        err,
        "Registration failed. Please try again.",
      ),
    });
  }

  async function onSubmit(values: RegisterValues) {
    const payload: RegisterRequest = {
      email: values.email.trim().toLowerCase(),
      password: values.password,
      firstName: values.firstName,
      middleName: values.middleName?.trim() || undefined,
      lastName: values.lastName,
      phoneNumber: values.phone?.trim() ?? "",
      timezone: values.timezone,
    };

    try {
      await registerUser(payload).unwrap();
      // "Check your inbox" names this address and can resend to it.
      rememberPendingVerificationEmail(payload.email);
      router.push("/auth/verification-pending");
    } catch (err) {
      applyServerError(err);
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      <header className="flex flex-col gap-2">
        <h1 className="type-page-title">Create your ContractFlow account</h1>
        <p className="text-xs text-muted-foreground">
          Set up your account and start managing contracts, teams, and workflows
          in one place.
        </p>
      </header>

      <FieldGroup className="gap-5">
        <RequiredFieldsNote />

        <FormSection legend="Full name">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-2">
            {nameFields.map(({ name, label, required, autoComplete }) => (
              <Controller
                key={name}
                name={name}
                control={form.control}
                render={({ field, fieldState }) => (
                  <FormField
                    id={name}
                    label={label}
                    required={required}
                    optional={!required}
                    error={fieldState.error?.message}
                  >
                    {(control) => (
                      <Input
                        {...field}
                        {...control}
                        value={field.value ?? ""}
                        autoComplete={autoComplete}
                        maxLength={100}
                      />
                    )}
                  </FormField>
                )}
              />
            ))}
          </div>
        </FormSection>

        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <FormField
              id="email"
              label="Email"
              required
              description="We'll send a verification link to this address."
              error={fieldState.error?.message}
            >
              {(control) => (
                <InputGroup>
                  <InputGroupAddon>
                    <RiMailLine aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    {...field}
                    {...control}
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    placeholder="name@company.com"
                  />
                </InputGroup>
              )}
            </FormField>
          )}
        />

        <Controller
          name="phone"
          control={form.control}
          render={({ field, fieldState }) => (
            <FormField
              id="phone"
              label="Phone number"
              optional
              error={fieldState.error?.message}
            >
              {(control) => (
                <InputGroup>
                  <InputGroupAddon>
                    <RiPhoneLine aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    {...field}
                    {...control}
                    value={field.value ?? ""}
                    type="tel"
                    maxLength={100}
                    autoComplete="tel"
                    placeholder="+1 (555) 000-0000"
                  />
                </InputGroup>
              )}
            </FormField>
          )}
        />

        <Controller
          name="timezone"
          control={form.control}
          render={({ field, fieldState }) => (
            <FormField
              id="timezone"
              label="Time zone"
              required
              description="Detected from your browser. Dates and times are shown in this time zone."
              error={fieldState.error?.message}
            >
              {(control) => (
                <Select
                  name={field.name}
                  value={field.value}
                  onValueChange={(v) => field.onChange(v ?? "")}
                >
                  <SelectTrigger {...control} className="w-full">
                    <RiGlobalLine
                      aria-hidden="true"
                      className="text-muted-foreground"
                    />
                    <SelectValue placeholder="Select a time zone" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {timezones.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <FormField
              id="password"
              label="Password"
              required
              description="12–255 characters, including a lowercase letter, uppercase letter, number, and symbol."
              error={fieldState.error?.message}
            >
              {(control) => (
                <PasswordInput
                  {...field}
                  {...control}
                  autoComplete="new-password"
                />
              )}
            </FormField>
          )}
        />

        <Controller
          name="confirmPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <FormField
              id="confirmPassword"
              label="Confirm password"
              required
              error={fieldState.error?.message}
            >
              {(control) => (
                <PasswordInput
                  {...field}
                  {...control}
                  autoComplete="new-password"
                />
              )}
            </FormField>
          )}
        />

        <Controller
          name="acceptTerms"
          control={form.control}
          render={({ field, fieldState }) => (
            // The terms open in a dialog, so reading them keeps the form.
            <LegalConsent
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              onBlur={field.onBlur}
              inputRef={field.ref}
              error={fieldState.error?.message}
            />
          )}
        />
      </FieldGroup>

      {form.formState.errors.root?.server && (
        <FieldError errors={[form.formState.errors.root.server]} />
      )}

      <Button
        type="submit"
        size="xl"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? "Creating account…" : "Continue"}
        <RiArrowRightLine data-icon="inline-end" className="rtl:rotate-180" />
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
