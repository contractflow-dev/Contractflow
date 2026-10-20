"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  useUpdateCompanyProfileMutation,
  type CompanyProfile,
} from "./companiesApi";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter a company name.").max(255),
  legalName: z.string().trim().min(1, "Enter a legal name.").max(255),
  registrationNumber: z
    .string()
    .trim()
    .min(1, "Enter a registration number.")
    .max(64),
  taxIdentificationNumber: z
    .string()
    .trim()
    .min(1, "Enter a tax identification number.")
    .max(64),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  phoneNumber: z.string().trim().min(1, "Enter a phone number.").max(20),
  website: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        (() => {
          try {
            const url = new URL(value);
            return url.protocol === "http:" || url.protocol === "https:";
          } catch {
            return false;
          }
        })(),
      "Enter a valid URL including https://.",
    )
    .max(255),
  addressLine1: z.string().trim().min(1, "Enter the street address.").max(255),
  addressLine2: z.string().trim().max(255),
  city: z.string().trim().min(1, "Enter a city.").max(100),
  stateRegion: z.string().trim().min(1, "Enter a state or region.").max(100),
  postalCode: z.string().trim().min(1, "Enter a postal code.").max(20),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Use a two-letter country code."),
  defaultCurrencyCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code."),
});

type ProfileValues = z.infer<typeof profileSchema>;
type ProfileField = keyof ProfileValues;

const profileFields: Array<{
  name: ProfileField;
  label: string;
  required?: boolean;
  type?: string;
}> = [
  { name: "name", label: "Company name", required: true },
  { name: "legalName", label: "Legal name", required: true },
  { name: "registrationNumber", label: "Registration number", required: true },
  {
    name: "taxIdentificationNumber",
    label: "Tax identification number",
    required: true,
  },
  { name: "email", label: "Company email", required: true, type: "email" },
  { name: "phoneNumber", label: "Phone number", required: true, type: "tel" },
  { name: "website", label: "Website", type: "url" },
  { name: "addressLine1", label: "Address line 1", required: true },
  { name: "addressLine2", label: "Address line 2" },
  { name: "city", label: "City", required: true },
  { name: "stateRegion", label: "State or region", required: true },
  { name: "postalCode", label: "Postal code", required: true },
  { name: "countryCode", label: "Country code", required: true },
  {
    name: "defaultCurrencyCode",
    label: "Default currency",
    required: true,
  },
];

function profileValues(company: CompanyProfile): ProfileValues {
  return {
    name: company.name,
    legalName: company.legalName,
    registrationNumber: company.registrationNumber,
    taxIdentificationNumber: company.taxIdentificationNumber,
    email: company.email,
    phoneNumber: company.phoneNumber,
    website: company.website,
    addressLine1: company.addressLine1,
    addressLine2: company.addressLine2,
    city: company.city,
    stateRegion: company.stateRegion,
    postalCode: company.postalCode,
    countryCode: company.countryCode,
    defaultCurrencyCode: company.defaultCurrencyCode,
  };
}

export function CompanyProfileEditor({
  company,
}: {
  company: CompanyProfile;
}) {
  const [updateProfile, mutationState] = useUpdateCompanyProfileMutation();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: profileValues(company),
  });

  async function submit(values: ProfileValues) {
    setFailure(null);
    setFeedback(null);
    try {
      const updated = await updateProfile({
        companyId: company.id,
        data: values,
      }).unwrap();
      reset(profileValues(updated));
      setFeedback("Company profile saved.");
    } catch (error) {
      setFailure(getApiErrorMessage(error, "Unable to save company profile."));
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">
          Company administration
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Company profile
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Update the company details used across ContractFlow.
        </p>
      </header>
      {feedback && (
        <p role="status" className="rounded-md border bg-card p-3 text-sm">
          {feedback}
        </p>
      )}
      {failure && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-card p-3 text-sm text-destructive"
        >
          {failure}
        </p>
      )}
      <form
        noValidate
        onSubmit={handleSubmit(submit)}
        className="space-y-6 rounded-xl border bg-card p-4 sm:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {profileFields.map(({ name, label, required, type = "text" }) => (
            <label key={name} className="grid gap-1.5 text-sm font-medium">
              {label}
              <input
                {...register(name)}
                type={type}
                required={required}
                maxLength={
                  name === "name" || name === "legalName"
                    ? 255
                    : name === "registrationNumber" ||
                        name === "taxIdentificationNumber"
                      ? 64
                      : undefined
                }
                aria-invalid={Boolean(errors[name])}
                aria-describedby={errors[name] ? `${name}-error` : undefined}
                disabled={mutationState.isLoading}
                className="h-10 rounded-md border bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive disabled:opacity-60"
              />
              {errors[name]?.message && (
                <span
                  id={`${name}-error`}
                  role="alert"
                  className="text-xs font-normal text-destructive"
                >
                  {errors[name]?.message}
                </span>
              )}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!isDirty || isSubmitting || mutationState.isLoading}
            className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {mutationState.isLoading ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            disabled={!isDirty || mutationState.isLoading}
            onClick={() => reset(profileValues(company))}
            className="min-h-10 rounded-md border px-4 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            Discard changes
          </button>
          <span className="text-xs text-muted-foreground">
            Company status and verification settings are managed separately.
          </span>
        </div>
      </form>
    </div>
  );
}
