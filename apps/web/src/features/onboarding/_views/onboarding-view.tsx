"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/apiError";
import { useCreateCompanyMutation } from "@/features/companies";
import { useGetCurrentUserQuery } from "@/services/authApi";
import { setActiveWorkspaceId } from "@/features/workspace/workspaceSlice";
import { useAppDispatch } from "@/store/hooks";
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

const currencyCodes = Object.values(ECurrencyCode);

// One column in the narrow half-width panel (lg), two columns when there's room.
const FIELD_GRID_CLASS = "lg:grid-cols-1 xl:grid-cols-2";

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

export function OnboardingView() {
  const dispatch = useAppDispatch();
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
    control,
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

  const countryCode = useWatch({ control, name: "countryCode" });
  const defaultCurrencyCode = useWatch({
    control,
    name: "defaultCurrencyCode",
  });

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
      const response = await createCompany({
        ...values,
        countryCode: values.countryCode as ECountryCode,
        defaultCurrencyCode: values.defaultCurrencyCode as ECurrencyCode,
      }).unwrap();
      dispatch(setActiveWorkspaceId(response.company.id));
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
          <h1 className="type-page-title">
            {createdCompany.name} is ready
          </h1>
          <p role="status" className="text-sm leading-6 text-muted-foreground">
            Your company has been created.
            {createdCompany.isAdmin
              ? " You're its administrator, so you can invite your team and set up contracts."
              : " Your membership is active."}
          </p>
          <Link
            href="/dashboards"
            className={buttonVariants({
              size: "xl",
              className: "w-full",
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
        <h1 className="type-page-title">
          Create your company
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Add your organization details to set up its ContractFlow workspace.
          You&apos;ll be the administrator of the company you create. If you were
          invited to join an existing company, open the invitation link in your
          email instead.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
        {serverError && (
          <Alert
            variant="destructive"
            className="border-destructive/30 bg-destructive/10"
          >
            <AlertDescription className="text-destructive-soft-foreground">
              {serverError}
            </AlertDescription>
          </Alert>
        )}

        <RequiredFieldsNote />

        <FormSection legend="Organization information">
          <FormGrid className={FIELD_GRID_CLASS}>
            <FormField
              id="name"
              label="Company name"
              required
              error={errors.name?.message}
            >
              {(control) => (
                <Input
                  {...control}
                  autoComplete="organization"
                  {...register("name")}
                />
              )}
            </FormField>
            <FormField
              id="legalName"
              label="Legal name"
              required
              description="The name the company is registered under."
              error={errors.legalName?.message}
            >
              {(control) => <Input {...control} {...register("legalName")} />}
            </FormField>
            <FormField
              id="registrationNumber"
              label="Registration number"
              required
              error={errors.registrationNumber?.message}
            >
              {(control) => (
                <Input {...control} {...register("registrationNumber")} />
              )}
            </FormField>
            <FormField
              id="taxIdentificationNumber"
              label="Tax identification number"
              required
              error={errors.taxIdentificationNumber?.message}
            >
              {(control) => (
                <Input {...control} {...register("taxIdentificationNumber")} />
              )}
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection legend="Contact information">
          <FormGrid className={FIELD_GRID_CLASS}>
            <FormField
              id="email"
              label="Company email"
              required
              description="Other companies invite you to contracts at this address. You'll verify it after creating the company."
              error={errors.email?.message}
            >
              {(control) => (
                <Input
                  {...control}
                  type="email"
                  autoComplete="email"
                  {...register("email")}
                />
              )}
            </FormField>
            <FormField
              id="phoneNumber"
              label="Phone number"
              required
              error={errors.phoneNumber?.message}
            >
              {(control) => (
                <Input
                  {...control}
                  type="tel"
                  autoComplete="tel"
                  {...register("phoneNumber")}
                />
              )}
            </FormField>
            <FormField
              id="website"
              label="Website"
              optional
              description="Include https://, for example https://example.com."
              error={errors.website?.message}
            >
              {(control) => (
                <Input
                  {...control}
                  type="url"
                  autoComplete="url"
                  {...register("website")}
                />
              )}
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection legend="Business address and currency">
          <FormGrid className={FIELD_GRID_CLASS}>
            <FormField
              id="addressLine1"
              label="Address line 1"
              required
              error={errors.addressLine1?.message}
            >
              {(control) => (
                <Input
                  {...control}
                  autoComplete="address-line1"
                  {...register("addressLine1")}
                />
              )}
            </FormField>
            <FormField
              id="addressLine2"
              label="Address line 2"
              optional
              error={errors.addressLine2?.message}
            >
              {(control) => (
                <Input
                  {...control}
                  autoComplete="address-line2"
                  {...register("addressLine2")}
                />
              )}
            </FormField>
            <FormField
              id="city"
              label="City"
              required
              error={errors.city?.message}
            >
              {(control) => (
                <Input
                  {...control}
                  autoComplete="address-level2"
                  {...register("city")}
                />
              )}
            </FormField>
            <FormField
              id="stateRegion"
              label="State or region"
              required
              error={errors.stateRegion?.message}
            >
              {(control) => (
                <Input
                  {...control}
                  autoComplete="address-level1"
                  {...register("stateRegion")}
                />
              )}
            </FormField>
            <FormField
              id="postalCode"
              label="Postal code"
              required
              error={errors.postalCode?.message}
            >
              {(control) => (
                <Input
                  {...control}
                  autoComplete="postal-code"
                  {...register("postalCode")}
                />
              )}
            </FormField>
            <FormField
              id="countryCode"
              label="Country"
              required
              error={errors.countryCode?.message}
            >
              {(control) => (
                <NativeSelect
                  {...control}
                  autoComplete="country"
                  className="w-full"
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
              )}
            </FormField>
            <FormField
              id="defaultCurrencyCode"
              label="Default currency"
              required
              description="Filled in from the country you select. You can change it."
              error={errors.defaultCurrencyCode?.message}
            >
              {(control) => (
                <NativeSelect
                  {...control}
                  className="w-full"
                  value={defaultCurrencyCode}
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
              )}
            </FormField>
          </FormGrid>
        </FormSection>

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
            size="xl"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating company…" : "Create company"}
          </Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
