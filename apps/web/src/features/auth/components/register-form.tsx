"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  RiArrowRightLine,
  RiGlobalLine,
  RiMailLine,
  RiPhoneLine,
} from "@remixicon/react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
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

import { registerSchema, type RegisterValues } from "../registerSchema";
import { PasswordInput } from "./password-input";

const labelClass =
  "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

const nameFields = [
  { name: "firstName", placeholder: "First name" },
  { name: "middleName", placeholder: "Middle name" },
  { name: "lastName", placeholder: "Last name" },
] as const;

export function RegisterForm() {
  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
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

  useEffect(() => {
    form.setValue("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [form]);

  function onSubmit(values: RegisterValues) {
    // TODO: call the RTK Query register mutation, then advance the onboarding slice
    console.log(values);
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      <header className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit text-[10px]">
          STEP 1 OF 4
        </Badge>
        <h1 className="font-heading text-2xl font-bold">
          Create your ContractFlow account
        </h1>
        <p className="text-xs text-muted-foreground">
          Set up your account and start managing contracts, teams, and workflows
          in one place.
        </p>
      </header>

      <FieldGroup className="gap-4">
        {/* Full name */}
        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Full name</span>
          <div className="grid grid-cols-3 gap-2">
            {nameFields.map(({ name, placeholder }) => (
              <Controller
                key={name}
                name={name}
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder={placeholder}
                      aria-label={placeholder}
                      aria-invalid={fieldState.invalid}
                      className="text-xs"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            ))}
          </div>
        </div>

        {/* Email */}
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email" className={labelClass}>
                Email * · Max 254 characters
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <RiMailLine />
                </InputGroupAddon>
                <InputGroupInput
                  {...field}
                  id="email"
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  placeholder="name@company.com"
                  aria-invalid={fieldState.invalid}
                />
              </InputGroup>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Phone */}
        <Controller
          name="phone"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="phone" className={labelClass}>
                Phone number · Optional · Max 100 characters
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <RiPhoneLine />
                </InputGroupAddon>
                <InputGroupInput
                  {...field}
                  value={field.value ?? ""}
                  id="phone"
                  type="tel"
                  maxLength={100}
                  autoComplete="tel"
                  placeholder="+1 (555) 000-0000"
                  aria-invalid={fieldState.invalid}
                />
              </InputGroup>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Timezone */}
        <Controller
          name="timezone"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="timezone" className={labelClass}>
                Timezone *
              </FieldLabel>
              <Select
                name={field.name}
                value={field.value}
                onValueChange={(v) => field.onChange(v ?? "")}
              >
                <SelectTrigger
                  id="timezone"
                  className="w-full"
                  aria-invalid={fieldState.invalid}
                >
                  <RiGlobalLine className="text-muted-foreground" />
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Password */}
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="password" className={labelClass}>
                Password *
              </FieldLabel>
              <PasswordInput
                {...field}
                id="password"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription className="text-[11px]">
                12–255 characters, including a lowercase letter, uppercase
                letter, number, and symbol.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Confirm password */}
        <Controller
          name="confirmPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="confirmPassword" className={labelClass}>
                Confirm password
              </FieldLabel>
              <PasswordInput
                {...field}
                id="confirmPassword"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Terms */}
        <Controller
          name="acceptTerms"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid}>
              <Checkbox
                id="acceptTerms"
                name={field.name}
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                aria-invalid={fieldState.invalid}
              />
              <FieldLabel htmlFor="acceptTerms" className="text-xs font-normal">
                <span>
                  I agree to the{" "}
                  <Link href="/terms" className="underline underline-offset-4">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="underline underline-offset-4"
                  >
                    Privacy Policy
                  </Link>
                </span>
              </FieldLabel>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        Continue
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
