"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ECountryCode, ECurrencyCode } from "@contractflow/contracts-schema";
import { countryCodes, countryOptions } from "@/lib/countries";
import { websiteSchema } from "@/lib/website";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import {
  FormField,
  FormGrid,
  FormSection,
  RequiredFieldsNote,
} from "@/components/forms/form-field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Separator } from "@workspace/ui/components/separator";
import { useUpdateCompanyProfileMutation } from "@/features/companies";
import type { ICompanyProfileResponse } from "@contractflow/contracts-schema";
import { getApiErrorMessage } from "@/lib/apiError";
import { notifySuccess } from "@/lib/notify";
import { CompanyAdminShell } from "@/features/companies/CompanyAdminShell";
import { CompanyVerificationNotice } from "@/features/companies/company-verification-notice";
import { PageHeader } from "@/components/page-header/page-header";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(255),
  legalName: z.string().trim().min(1, "Legal name is required").max(255),
  registrationNumber: z
    .string()
    .trim()
    .min(1, "Registration number is required")
    .max(64),
  taxIdentificationNumber: z
    .string()
    .trim()
    .min(1, "Tax identification number is required")
    .max(64),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email("Enter a valid email")),
  phoneNumber: z.string().trim().min(1, "Phone number is required").max(20),
  website: websiteSchema,
  addressLine1: z.string().trim().min(1, "Address is required").max(255),
  addressLine2: z.string().trim().max(255),
  city: z.string().trim().min(1, "City is required").max(100),
  stateRegion: z.string().trim().min(1, "State or region is required").max(100),
  postalCode: z.string().trim().min(1, "Postal code is required").max(20),
  countryCode: z.enum(countryCodes, { message: "Select a country" }),
  defaultCurrencyCode: z.enum(
    Object.values(ECurrencyCode) as [ECurrencyCode, ...ECurrencyCode[]],
    { message: "Select a currency" },
  ),
});

type ProfileValues = z.infer<typeof profileSchema>;

type TextFieldKey = Exclude<
  keyof ProfileValues,
  "countryCode" | "defaultCurrencyCode"
>;

interface ProfileTextField {
  key: TextFieldKey;
  label: string;
  /** Matches the schema: every field is required unless marked optional. */
  optional?: boolean;
  type?: "email" | "tel" | "url";
  autoComplete?: string;
  description?: string;
  className?: string;
}

const organizationFields: ProfileTextField[] = [
  { key: "name", label: "Company name", autoComplete: "organization" },
  {
    key: "legalName",
    label: "Legal name",
    autoComplete: "organization",
    description: "The name the company is registered under.",
  },
  { key: "registrationNumber", label: "Registration number" },
  { key: "taxIdentificationNumber", label: "Tax identification number" },
];

const contactFields: ProfileTextField[] = [
  {
    key: "email",
    label: "Company email",
    type: "email",
    autoComplete: "email",
    description:
      "Other companies invite you to contracts at this address. A new address must be verified again.",
    className: "sm:col-span-2",
  },
  { key: "phoneNumber", label: "Phone number", type: "tel", autoComplete: "tel" },
  {
    key: "website",
    label: "Website",
    optional: true,
    type: "url",
    autoComplete: "url",
  },
];

const addressFields: ProfileTextField[] = [
  {
    key: "addressLine1",
    label: "Address line 1",
    autoComplete: "address-line1",
  },
  {
    key: "addressLine2",
    label: "Address line 2",
    optional: true,
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

export function CompanyProfileView() {
  return (
    <CompanyAdminShell>
      {(access) => (
        <div className="space-y-6">
          <CompanyVerificationNotice company={access.company} />
          <ProfileContent company={access.company} />
        </div>
      )}
    </CompanyAdminShell>
  );
}

function ProfileContent({ company }: { company: ICompanyProfileResponse }) {
  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Company administration"
        title="Company profile"
        description="Update the registered company and contact details."
      />
      <ProfileForm key={company.id} company={company} />
    </section>
  );
}

function ProfileForm({ company }: { company: ICompanyProfileResponse }) {
  const [updateProfile, { isLoading }] = useUpdateCompanyProfileMutation();
  const [submitError, setSubmitError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
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
    try {
      await updateProfile({ companyId: company.id, data: values }).unwrap();
      reset(values);
      notifySuccess("Company profile updated");
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(error, "Company profile could not be saved."),
      );
    }
  }

  function textFields(list: ProfileTextField[]) {
    return list.map(
      ({ key, label, optional, type, autoComplete, description, className }) => (
        <FormField
          key={key}
          id={`profile-${key}`}
          label={label}
          required={!optional}
          optional={optional}
          description={description}
          error={errors[key]?.message}
          className={className}
        >
          {(control) => (
            <Input
              {...control}
              {...register(key)}
              type={type}
              autoComplete={autoComplete}
            />
          )}
        </FormField>
      ),
    );
  }

  return (
    <Card>
      <CardContent>
        <form
          onSubmit={handleSubmit(save)}
          noValidate
          aria-label="Company profile"
          className="space-y-6"
        >
          {submitError && (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
          <RequiredFieldsNote />

          <FormSection legend="Organization information">
            <FormGrid columns={2}>{textFields(organizationFields)}</FormGrid>
          </FormSection>

          <FormSection legend="Contact information">
            <FormGrid columns={2}>{textFields(contactFields)}</FormGrid>
          </FormSection>

          <FormSection legend="Business address and currency">
            <FormGrid columns={2}>
              {textFields(addressFields)}
              <FormField
                id="profile-countryCode"
                label="Country"
                required
                error={errors.countryCode?.message}
              >
                {(control) => (
                  <NativeSelect
                    {...control}
                    className="w-full"
                    {...register("countryCode")}
                    autoComplete="country"
                  >
                    {countryOptions.map(({ code, name }) => (
                      <NativeSelectOption key={code} value={code}>
                        {name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
              <FormField
                id="profile-defaultCurrencyCode"
                label="Default currency"
                required
                error={errors.defaultCurrencyCode?.message}
              >
                {(control) => (
                  <NativeSelect
                    {...control}
                    className="w-full"
                    {...register("defaultCurrencyCode")}
                  >
                    {Object.values(ECurrencyCode).map((currency) => (
                      <NativeSelectOption key={currency} value={currency}>
                        {currency}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            </FormGrid>
          </FormSection>

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
