"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ECountryCode, ECurrencyCode } from "@contractflow/contracts-schema";
import { countryCodes, countryOptions } from "@/lib/countries";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Separator } from "@workspace/ui/components/separator";
import {
  useGetCompanyDashboardQuery,
  useUpdateCompanyProfileMutation,
} from "@/features/companies";
import type { CompanyProfile } from "@/features/companies";
import { getApiErrorMessage } from "@/lib/apiError";
import { CompanyAdminWorkspace } from "../company-admin-workspace";

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
  countryCode: z.enum(countryCodes, { message: "Select a country" }),
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
];

export function CompanyProfileView({
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
        <Alert role="status">
          <AlertDescription>Loading company profile…</AlertDescription>
        </Alert>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getApiErrorMessage(error, "Company details could not be loaded.")}
          </AlertDescription>
        </Alert>
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
      countryCode: company.countryCode as ECountryCode,
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
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit(save)} noValidate className="space-y-6">
          {submitError && (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
          {saved && (
            <Alert role="status">
              <AlertDescription>Company profile updated.</AlertDescription>
            </Alert>
          )}
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            {fields.map(({ key, label, autoComplete }) => (
              <Field key={key} data-invalid={Boolean(errors[key])}>
                <FieldLabel htmlFor={`profile-${key}`}>{label}</FieldLabel>
                <Input
                  id={`profile-${key}`}
                  {...register(key)}
                  autoComplete={autoComplete}
                  aria-invalid={Boolean(errors[key])}
                />
                <FieldError>{errors[key]?.message}</FieldError>
              </Field>
            ))}
            <Field data-invalid={Boolean(errors.countryCode)}>
              <FieldLabel htmlFor="profile-countryCode">Country</FieldLabel>
              <NativeSelect
                id="profile-countryCode"
                className="w-full"
                {...register("countryCode")}
                autoComplete="country"
                aria-invalid={Boolean(errors.countryCode)}
              >
                {countryOptions.map(({ code, name }) => (
                  <NativeSelectOption key={code} value={code}>
                    {name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError>{errors.countryCode?.message}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.defaultCurrencyCode)}>
              <FieldLabel htmlFor="profile-defaultCurrencyCode">
                Default currency
              </FieldLabel>
              <NativeSelect
                id="profile-defaultCurrencyCode"
                className="w-full"
                {...register("defaultCurrencyCode")}
                aria-invalid={Boolean(errors.defaultCurrencyCode)}
              >
                {Object.values(ECurrencyCode).map((currency) => (
                  <NativeSelectOption key={currency} value={currency}>
                    {currency}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError>{errors.defaultCurrencyCode?.message}</FieldError>
            </Field>
          </FieldGroup>
          <Separator />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
      </CardContent>
    </Card>
  );
}
