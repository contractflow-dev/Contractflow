"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/apiError";
import { useCreateCompanyMutation } from "@/features/companies";
import { useGetCurrentUserQuery } from "@/services/authApi";
import { AuthTopBar } from "@/components/auth/authTopBar";
import { HeroMetrics } from "@/components/auth/HeroMetrics";
import {
  ECountryCode,
  ECurrencyCode,
  COUNTRY_CURRENCY_MAP,
} from "@contractflow/contracts-schema";
import { countryCodes, countryOptions } from "@/lib/countries";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button, buttonVariants } from "@workspace/ui/components/button";
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

// One column in the narrow half-width panel (lg), two columns when there's room.
const FIELD_GRID_CLASS =
  "grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2";

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

function OnboardingShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className="grid min-h-svh min-w-0 grid-cols-1 lg:grid-cols-2">
      <section className="flex min-w-0 flex-col p-4 sm:p-6 lg:p-10">
        {/* Static top bar: stays in place regardless of content height */}
        <AuthTopBar />

        {/* Content area: fills remaining height and centers its content */}
        <div className="flex flex-1 items-center justify-center">
          <div
            className={cn(
              "w-full min-w-0 max-w-md space-y-6 py-4 sm:py-6",
              className,
            )}
          >
            {children}
          </div>
        </div>
      </section>

      <aside className="relative hidden min-w-0 flex-col justify-between overflow-hidden bg-auth-hero bg-cover bg-center p-10 text-hero-foreground lg:sticky lg:top-0 lg:flex lg:min-h-svh lg:self-start">
        <div className="absolute inset-0 bg-hero-overlay" aria-hidden="true" />

        <span className="relative z-10 text-lg font-semibold tracking-tight">
          ContractFlow
        </span>

        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold leading-tight">
              Every contract, from tender to close-out, in one place.
            </h2>
            <p className="max-w-md text-sm text-hero-muted">
              Track vendors, approvals, milestones and obligations across your
              oil and gas operations.
            </p>
          </div>
          <HeroMetrics className="mt-4 gap-8 xl:mt-2 xl:gap-1" />
          <p className="text-xs text-hero-muted">
            &copy; {new Date().getFullYear()} ContractFlow
          </p>
        </div>
      </aside>
    </main>
  );
}

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

export function OnboardingView() {
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
      <OnboardingShell>
        <div className="space-y-5">
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
            className={buttonVariants({
              size: "lg",
              className: "h-11 w-full px-4",
            })}
          >
            Open company dashboard
          </Link>
        </div>
      </OnboardingShell>
    );
  }

  if (isLoadingUser) {
    return (
      <OnboardingShell>
        <p role="status" className="text-sm text-muted-foreground">
          Confirming your account…
        </p>
      </OnboardingShell>
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
        <OnboardingShell>
          <p role="status" className="text-sm text-muted-foreground">
            Redirecting to sign in…
          </p>
        </OnboardingShell>
      );
    }
    return (
      <OnboardingShell>
        <Alert variant="destructive" className="break-words">
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
      </OnboardingShell>
    );
  }

  if (!currentUser?.emailVerifiedAt) {
    return (
      <OnboardingShell>
        <p role="status" className="text-sm text-muted-foreground">
          Redirecting to email verification…
        </p>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell className="max-w-2xl space-y-8">
      <header className="space-y-2">
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

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
        {serverError && (
          <Alert
            variant="destructive"
            className="border-destructive/30 bg-destructive/10"
          >
            <AlertDescription className="text-destructive">
              {serverError}
            </AlertDescription>
          </Alert>
        )}

        <FieldSet>
          <FieldLegend>Company information</FieldLegend>
          <FieldGroup className={FIELD_GRID_CLASS}>
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
          <FieldGroup className={FIELD_GRID_CLASS}>
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
                <NativeSelectOption value="">
                  Select a country
                </NativeSelectOption>
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
                <NativeSelectOption value="">
                  Select a currency
                </NativeSelectOption>
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
    </OnboardingShell>
  );
}
