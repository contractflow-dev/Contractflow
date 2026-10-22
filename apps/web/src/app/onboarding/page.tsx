"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getApiErrorMessage } from "@/lib/apiError";
import { useCreateCompanyMutation } from "@/features/companies";
import { useGetCurrentUserQuery } from "@/services/authApi";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  ECountryCode,
  ECurrencyCode,
  COUNTRY_CURRENCY_MAP,
} from "@contractflow/contracts-schema";
import { countryCodes, countryOptions } from "@/lib/countries";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Separator } from "@workspace/ui/components/separator";

const currencyCodes = Object.values(ECurrencyCode);

const companySchema = z.object({
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
    .pipe(z.email("Enter a valid company email")),
  phoneNumber: z.string().trim().min(1, "Phone number is required").max(20),
  website: z.union([z.literal(""), z.string().trim().url("Enter a valid URL")]),
  addressLine1: z.string().trim().min(1, "Address is required").max(255),
  addressLine2: z.string().trim().max(255),
  city: z.string().trim().min(1, "City is required").max(100),
  stateRegion: z.string().trim().min(1, "State or region is required").max(100),
  postalCode: z.string().trim().min(1, "Postal code is required").max(20),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine((code) => countryCodes.includes(code as ECountryCode), {
      message: "Select a country",
    }),
  defaultCurrencyCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine((code) => currencyCodes.includes(code as ECurrencyCode), {
      message: "Select a valid currency code",
    }),
});

type CompanyFormValues = z.infer<typeof companySchema>;

function CompanyField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <Field data-invalid={!!error} className="gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const {
    data: currentUser,
    isLoading: isLoadingUser,
    error: userError,
    refetch: refetchUser,
  } = useGetCurrentUserQuery();
  const [createCompany] = useCreateCompanyMutation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [createdCompany, setCreatedCompany] = useState<{
    id: string;
    name: string;
    isAdmin: boolean;
  } | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      legalName: "",
      registrationNumber: "",
      taxIdentificationNumber: "",
      email: "",
      phoneNumber: "",
      website: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      stateRegion: "",
      postalCode: "",
      countryCode: "",
      defaultCurrencyCode: "",
    },
  });

  const countryCode = watch("countryCode");

  useEffect(() => {
    if (!countryCode) {
      return;
    }

    const inferredCurrency =
      COUNTRY_CURRENCY_MAP[countryCode.trim().toUpperCase()];
    if (inferredCurrency) {
      setValue("defaultCurrencyCode", inferredCurrency, {
        shouldValidate: true,
      });
    }
  }, [countryCode, setValue]);

  useEffect(() => {
    if (userError) {
      const status =
        typeof userError === "object" &&
        userError !== null &&
        "status" in userError
          ? userError.status
          : null;
      if (status === 401) router.replace("/login");
    } else if (currentUser && !currentUser.emailVerifiedAt) {
      router.replace("/auth/verification-pending");
    }
  }, [currentUser, router, userError]);

  async function onSubmit(values: CompanyFormValues) {
    setServerError(null);
    try {
      const response = await createCompany(values).unwrap();
      setCreatedCompany({
        id: response.company.id,
        name: response.company.name,
        isAdmin: response.membership.canManageCompany,
      });
    } catch (error) {
      setServerError(
        getApiErrorMessage(error, "Company creation failed. Please try again."),
      );
    }
  }

  if (createdCompany) {
    return (
      <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
        <Card className="w-full max-w-xl gap-5 p-8">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-primary">ContractFlow</p>
            <ThemeToggle />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {createdCompany.name} is ready
          </h1>
          <p role="status" className="text-sm leading-6 text-muted-foreground">
            The server confirmed company creation.
            {createdCompany.isAdmin
              ? " Your company administrator access is active."
              : " Your membership is active."}
          </p>
          <Link
            href={`/dashboards?companyId=${encodeURIComponent(createdCompany.id)}`}
            className={buttonVariants({ size: "lg", className: "h-11 px-4" })}
          >
            Open company dashboard
          </Link>
        </Card>
      </main>
    );
  }

  if (isLoadingUser) {
    return (
      <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
        <p role="status" className="text-sm text-muted-foreground">
          Confirming your account…
        </p>
      </main>
    );
  }

  if (userError) {
    const status =
      typeof userError === "object" &&
      userError !== null &&
      "status" in userError
        ? userError.status
        : null;
    if (status === 401) {
      return (
        <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
          <p role="status" className="text-sm text-muted-foreground">
            Redirecting to sign in…
          </p>
        </main>
      );
    }
    return (
      <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
        <Card className="w-full max-w-lg gap-4 p-8">
          <Alert variant="destructive">
            <AlertDescription>
              {getApiErrorMessage(userError, "Unable to confirm your account.")}
            </AlertDescription>
          </Alert>
          <Button
            type="button"
            variant="link"
            onClick={() => void refetchUser()}
            className="self-start px-0"
          >
            Try again
          </Button>
        </Card>
      </main>
    );
  }

  if (!currentUser?.emailVerifiedAt) {
    return (
      <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
        <p role="status" className="text-sm text-muted-foreground">
          Redirecting to email verification…
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-muted/30 px-4 py-10 sm:px-6">
      <Card className="mx-auto max-w-4xl gap-8 p-6 sm:p-9">
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-primary">ContractFlow</p>
            <ThemeToggle />
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Company setup
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Create your company
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Add your organization details to set up its ContractFlow workspace.
            Your company membership and permissions are assigned by the server.
          </p>
        </header>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-8"
        >
          {serverError && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
              <AlertDescription className="text-destructive">
                {serverError}
              </AlertDescription>
            </Alert>
          )}

          <FieldSet>
            <FieldLegend>Company information</FieldLegend>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <CompanyField
                id="name"
                label="Company name"
                error={errors.name?.message}
              >
                <Input
                  id="name"
                  aria-invalid={!!errors.name}
                  {...register("name")}
                />
              </CompanyField>
              <CompanyField
                id="legalName"
                label="Legal name"
                error={errors.legalName?.message}
              >
                <Input
                  id="legalName"
                  aria-invalid={!!errors.legalName}
                  {...register("legalName")}
                />
              </CompanyField>
              <CompanyField
                id="registrationNumber"
                label="Registration number"
                error={errors.registrationNumber?.message}
              >
                <Input
                  id="registrationNumber"
                  aria-invalid={!!errors.registrationNumber}
                  {...register("registrationNumber")}
                />
              </CompanyField>
              <CompanyField
                id="taxIdentificationNumber"
                label="Tax identification number"
                error={errors.taxIdentificationNumber?.message}
              >
                <Input
                  id="taxIdentificationNumber"
                  aria-invalid={!!errors.taxIdentificationNumber}
                  {...register("taxIdentificationNumber")}
                />
              </CompanyField>
              <CompanyField
                id="email"
                label="Company email"
                error={errors.email?.message}
              >
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
              </CompanyField>
              <CompanyField
                id="phoneNumber"
                label="Phone number"
                error={errors.phoneNumber?.message}
              >
                <Input
                  id="phoneNumber"
                  type="tel"
                  autoComplete="tel"
                  aria-invalid={!!errors.phoneNumber}
                  {...register("phoneNumber")}
                />
              </CompanyField>
              <CompanyField
                id="website"
                label="Website"
                error={errors.website?.message}
              >
                <Input
                  id="website"
                  type="url"
                  placeholder="https://example.com"
                  aria-invalid={!!errors.website}
                  {...register("website")}
                />
              </CompanyField>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Business address</FieldLegend>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <CompanyField
                id="addressLine1"
                label="Address line 1"
                error={errors.addressLine1?.message}
              >
                <Input
                  id="addressLine1"
                  autoComplete="address-line1"
                  aria-invalid={!!errors.addressLine1}
                  {...register("addressLine1")}
                />
              </CompanyField>
              <CompanyField
                id="addressLine2"
                label="Address line 2"
                error={errors.addressLine2?.message}
              >
                <Input
                  id="addressLine2"
                  autoComplete="address-line2"
                  aria-invalid={!!errors.addressLine2}
                  {...register("addressLine2")}
                />
              </CompanyField>
              <CompanyField id="city" label="City" error={errors.city?.message}>
                <Input
                  id="city"
                  autoComplete="address-level2"
                  aria-invalid={!!errors.city}
                  {...register("city")}
                />
              </CompanyField>
              <CompanyField
                id="stateRegion"
                label="State or region"
                error={errors.stateRegion?.message}
              >
                <Input
                  id="stateRegion"
                  autoComplete="address-level1"
                  aria-invalid={!!errors.stateRegion}
                  {...register("stateRegion")}
                />
              </CompanyField>
              <CompanyField
                id="postalCode"
                label="Postal code"
                error={errors.postalCode?.message}
              >
                <Input
                  id="postalCode"
                  autoComplete="postal-code"
                  aria-invalid={!!errors.postalCode}
                  {...register("postalCode")}
                />
              </CompanyField>
              <CompanyField
                id="countryCode"
                label="Country"
                error={errors.countryCode?.message}
              >
                <NativeSelect
                  id="countryCode"
                  autoComplete="country"
                  className="w-full"
                  aria-invalid={!!errors.countryCode}
                  {...register("countryCode")}
                >
                  <NativeSelectOption value="">Select a country</NativeSelectOption>
                  {countryOptions.map(({ code, name }) => (
                    <NativeSelectOption key={code} value={code}>
                      {name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </CompanyField>
              <CompanyField
                id="defaultCurrencyCode"
                label="Default currency code"
                error={errors.defaultCurrencyCode?.message}
              >
                <NativeSelect
                  id="defaultCurrencyCode"
                  className="w-full"
                  aria-invalid={!!errors.defaultCurrencyCode}
                  value={watch("defaultCurrencyCode")}
                  onChange={(event) =>
                    setValue("defaultCurrencyCode", event.target.value, {
                      shouldValidate: true,
                    })
                  }
                >
                  <NativeSelectOption value="">Select a currency</NativeSelectOption>
                  {currencyCodes.map((currency) => (
                    <NativeSelectOption key={currency} value={currency}>
                      {currency}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </CompanyField>
            </FieldGroup>
          </FieldSet>

          <Separator />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/login"
              className="text-center text-sm text-muted-foreground underline underline-offset-4 sm:text-left"
            >
              Sign out and return to sign in
            </Link>
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="h-11 px-5"
            >
              {isSubmitting ? "Creating company…" : "Create company"}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
