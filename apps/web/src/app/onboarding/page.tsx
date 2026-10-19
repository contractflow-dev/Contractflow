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

const inputClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive disabled:opacity-60";

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
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
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
        <section className="w-full max-w-xl space-y-5 rounded-xl border bg-card p-8 shadow-sm">
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
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open company dashboard
          </Link>
        </section>
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
        <section className="w-full max-w-lg space-y-4 rounded-xl border bg-card p-8">
          <p role="alert" className="text-sm text-destructive">
            {getApiErrorMessage(userError, "Unable to confirm your account.")}
          </p>
          <button
            type="button"
            onClick={() => void refetchUser()}
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Try again
          </button>
        </section>
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
      <section className="mx-auto max-w-4xl space-y-8 rounded-xl border bg-card p-6 shadow-sm sm:p-9">
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
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {serverError}
            </p>
          )}

          <fieldset className="space-y-4">
            <legend className="text-base font-semibold">
              Company information
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <CompanyField
                id="name"
                label="Company name"
                error={errors.name?.message}
              >
                <input
                  id="name"
                  className={inputClass}
                  aria-invalid={!!errors.name}
                  {...register("name")}
                />
              </CompanyField>
              <CompanyField
                id="legalName"
                label="Legal name"
                error={errors.legalName?.message}
              >
                <input
                  id="legalName"
                  className={inputClass}
                  aria-invalid={!!errors.legalName}
                  {...register("legalName")}
                />
              </CompanyField>
              <CompanyField
                id="registrationNumber"
                label="Registration number"
                error={errors.registrationNumber?.message}
              >
                <input
                  id="registrationNumber"
                  className={inputClass}
                  aria-invalid={!!errors.registrationNumber}
                  {...register("registrationNumber")}
                />
              </CompanyField>
              <CompanyField
                id="taxIdentificationNumber"
                label="Tax identification number"
                error={errors.taxIdentificationNumber?.message}
              >
                <input
                  id="taxIdentificationNumber"
                  className={inputClass}
                  aria-invalid={!!errors.taxIdentificationNumber}
                  {...register("taxIdentificationNumber")}
                />
              </CompanyField>
              <CompanyField
                id="email"
                label="Company email"
                error={errors.email?.message}
              >
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={inputClass}
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
              </CompanyField>
              <CompanyField
                id="phoneNumber"
                label="Phone number"
                error={errors.phoneNumber?.message}
              >
                <input
                  id="phoneNumber"
                  type="tel"
                  autoComplete="tel"
                  className={inputClass}
                  aria-invalid={!!errors.phoneNumber}
                  {...register("phoneNumber")}
                />
              </CompanyField>
              <CompanyField
                id="website"
                label="Website"
                error={errors.website?.message}
              >
                <input
                  id="website"
                  type="url"
                  placeholder="https://example.com"
                  className={inputClass}
                  aria-invalid={!!errors.website}
                  {...register("website")}
                />
              </CompanyField>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-base font-semibold">
              Business address
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <CompanyField
                id="addressLine1"
                label="Address line 1"
                error={errors.addressLine1?.message}
              >
                <input
                  id="addressLine1"
                  autoComplete="address-line1"
                  className={inputClass}
                  aria-invalid={!!errors.addressLine1}
                  {...register("addressLine1")}
                />
              </CompanyField>
              <CompanyField
                id="addressLine2"
                label="Address line 2"
                error={errors.addressLine2?.message}
              >
                <input
                  id="addressLine2"
                  autoComplete="address-line2"
                  className={inputClass}
                  aria-invalid={!!errors.addressLine2}
                  {...register("addressLine2")}
                />
              </CompanyField>
              <CompanyField id="city" label="City" error={errors.city?.message}>
                <input
                  id="city"
                  autoComplete="address-level2"
                  className={inputClass}
                  aria-invalid={!!errors.city}
                  {...register("city")}
                />
              </CompanyField>
              <CompanyField
                id="stateRegion"
                label="State or region"
                error={errors.stateRegion?.message}
              >
                <input
                  id="stateRegion"
                  autoComplete="address-level1"
                  className={inputClass}
                  aria-invalid={!!errors.stateRegion}
                  {...register("stateRegion")}
                />
              </CompanyField>
              <CompanyField
                id="postalCode"
                label="Postal code"
                error={errors.postalCode?.message}
              >
                <input
                  id="postalCode"
                  autoComplete="postal-code"
                  className={inputClass}
                  aria-invalid={!!errors.postalCode}
                  {...register("postalCode")}
                />
              </CompanyField>
              <CompanyField
                id="countryCode"
                label="Country"
                error={errors.countryCode?.message}
              >
                <select
                  id="countryCode"
                  autoComplete="country"
                  className={inputClass}
                  aria-invalid={!!errors.countryCode}
                  {...register("countryCode")}
                >
                  <option value="">Select a country</option>
                  {countryOptions.map(({ code, name }) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </CompanyField>
              <CompanyField
                id="defaultCurrencyCode"
                label="Default currency code"
                error={errors.defaultCurrencyCode?.message}
              >
                <select
                  id="defaultCurrencyCode"
                  className={inputClass}
                  aria-invalid={!!errors.defaultCurrencyCode}
                  value={watch("defaultCurrencyCode")}
                  onChange={(event) =>
                    setValue("defaultCurrencyCode", event.target.value, {
                      shouldValidate: true,
                    })
                  }
                >
                  <option value="">Select a currency</option>
                  {currencyCodes.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </CompanyField>
            </div>
          </fieldset>

          <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/login"
              className="text-center text-sm text-muted-foreground underline underline-offset-4 sm:text-left"
            >
              Sign out and return to sign in
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Creating company…" : "Create company"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
