"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ECurrencyCode } from "@contractflow/contracts-schema";
import { Button } from "@workspace/ui/components/button";
import {
  useGetCompanyDashboardQuery,
  useUpdateCompanyProfileMutation,
} from "@/features/companies";
import type { CompanyProfile } from "@/features/companies";
import { getApiErrorMessage } from "@/lib/apiError";
import { CompanyAdminWorkspace } from "./company-admin-workspace";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(255),
  legalName: z.string().trim().min(1, "Legal name is required").max(255),
  registrationNumber: z.string().trim().min(1).max(64),
  taxIdentificationNumber: z.string().trim().min(1).max(64),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email("Enter a valid email")),
  phoneNumber: z.string().trim().min(1).max(20),
  website: z.union([z.literal(""), z.string().trim().url("Enter a valid URL")]),
  addressLine1: z.string().trim().min(1).max(255),
  addressLine2: z.string().trim().max(255),
  city: z.string().trim().min(1).max(100),
  stateRegion: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(20),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a two-letter country code"),
  defaultCurrencyCode: z.enum(
    Object.values(ECurrencyCode) as [ECurrencyCode, ...ECurrencyCode[]],
  ),
});

type ProfileValues = z.infer<typeof profileSchema>;

const fields: Array<{
  key: keyof ProfileValues;
  label: string;
  autoComplete?: string;
}> = [
  { key: "name", label: "Company name", autoComplete: "organization" },
  { key: "legalName", label: "Legal name", autoComplete: "organization" },
  { key: "registrationNumber", label: "Registration number" },
  { key: "taxIdentificationNumber", label: "Tax identification number" },
  { key: "email", label: "Contact email", autoComplete: "email" },
  { key: "phoneNumber", label: "Phone number", autoComplete: "tel" },
  { key: "website", label: "Website", autoComplete: "url" },
  {
    key: "addressLine1",
    label: "Address line 1",
    autoComplete: "address-line1",
  },
  {
    key: "addressLine2",
    label: "Address line 2",
    autoComplete: "address-line2",
  },
  { key: "city", label: "City", autoComplete: "address-level2" },
  {
    key: "stateRegion",
    label: "State or region",
    autoComplete: "address-level1",
  },
  { key: "postalCode", label: "Postal code", autoComplete: "postal-code" },
  { key: "countryCode", label: "Country code", autoComplete: "country" },
];

export function CompanyProfilePage({
  initialCompanyId,
}: {
  initialCompanyId: string;
}) {
  return (
    <CompanyAdminWorkspace
      companyId={initialCompanyId}
      activePath="/dashboards/profile"
    >
      {(companyId) => <ProfileContent companyId={companyId} />}
    </CompanyAdminWorkspace>
  );
}

function ProfileContent({ companyId }: { companyId: string }) {
  const { currentData, error, isLoading } = useGetCompanyDashboardQuery({
    companyId,
  });

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">
          Company administration
        </p>
        <h2 className="mt-1 font-heading text-2xl font-semibold tracking-tight">
          Company profile
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the registered company and contact details.
        </p>
      </header>
      {isLoading ? (
        <p
          role="status"
          className="rounded-xl border bg-card p-6 text-sm text-muted-foreground"
        >
          Loading company profile…
        </p>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p role="alert" className="text-sm text-destructive">
            {getApiErrorMessage(error, "Company details could not be loaded.")}
          </p>
        </div>
      ) : currentData ? (
        <ProfileForm
          key={companyId}
          companyId={companyId}
          company={currentData.company}
        />
      ) : null}
    </section>
  );
}

function ProfileForm({
  companyId,
  company,
}: {
  companyId: string;
  company: CompanyProfile;
}) {
  const [updateProfile, { isLoading }] = useUpdateCompanyProfileMutation();
  const [submitError, setSubmitError] = useState("");
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
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
      defaultCurrencyCode: company.defaultCurrencyCode as ECurrencyCode,
    },
  });

  async function save(values: ProfileValues) {
    setSubmitError("");
    setSaved(false);
    try {
      await updateProfile({ companyId, data: values }).unwrap();
      setSaved(true);
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(error, "Company profile could not be saved."),
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit(save)}
      noValidate
      className="space-y-6 rounded-xl border bg-card p-5 shadow-sm sm:p-7"
    >
      {submitError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {submitError}
        </p>
      )}
      {saved && (
        <p
          role="status"
          className="rounded-md border border-emerald-600/20 bg-emerald-600/5 p-3 text-sm text-emerald-700 dark:text-emerald-400"
        >
          Company profile updated.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(({ key, label, autoComplete }) => (
          <label key={key} className="space-y-1.5 text-sm font-medium">
            {label}
            <input
              {...register(key)}
              autoComplete={autoComplete}
              aria-invalid={Boolean(errors[key])}
              className={inputClass}
            />
            {errors[key]?.message && (
              <span role="alert" className="block text-xs text-destructive">
                {errors[key]?.message}
              </span>
            )}
          </label>
        ))}
        <label className="space-y-1.5 text-sm font-medium">
          Default currency
          <select
            {...register("defaultCurrencyCode")}
            aria-invalid={Boolean(errors.defaultCurrencyCode)}
            className={inputClass}
          >
            {Object.values(ECurrencyCode).map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
          {errors.defaultCurrencyCode?.message && (
            <span role="alert" className="block text-xs text-destructive">
              {errors.defaultCurrencyCode.message}
            </span>
          )}
        </label>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={!isDirty || isLoading}
          onClick={() => window.location.reload()}
        >
          Reset
        </Button>
        <Button type="submit" disabled={!isDirty || isLoading}>
          {isLoading ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive";
