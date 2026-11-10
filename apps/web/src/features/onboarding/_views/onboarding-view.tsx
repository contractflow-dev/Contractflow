"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { RiMailLine } from "@remixicon/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/apiError";
import { useCreateCompanyMutation } from "@/features/companies";
import { useGetCurrentUserQuery } from "@/services/authApi";
import { setActiveWorkspaceId } from "@/features/workspace/workspaceSlice";
import { useAppDispatch } from "@/store/hooks";
import { AuthTopBar } from "@/components/auth/authTopBar";
import { AuthHero } from "@/components/auth/auth-hero";
import { SignOutAction } from "@/components/auth/sign-out-action";
import {
  ECountryCode,
  ECurrencyCode,
  COUNTRY_CURRENCY_MAP,
} from "@contractflow/contracts-schema";
import { countryCodes, countryOptions } from "@/lib/countries";
import { websiteSchema } from "@/lib/website";
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
  website: websiteSchema,
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

/**
 * Company creation in three short steps. Every field is still required by
 * the API; the steps only spread them out.
 */
export const companySetupSteps: Array<{
  id: "company" | "contact" | "address";
  title: string;
  fields: Array<FieldPath<CompanyFormValues>>;
}> = [
  {
    id: "company",
    title: "Company and legal details",
    fields: ["name", "legalName", "registrationNumber", "taxIdentificationNumber"],
  },
  {
    id: "contact",
    title: "Contact",
    fields: ["email", "phoneNumber", "website"],
  },
  {
    id: "address",
    title: "Address and currency",
    fields: [
      "addressLine1",
      "addressLine2",
      "city",
      "stateRegion",
      "postalCode",
      "countryCode",
      "defaultCurrencyCode",
    ],
  },
];
const lastStep = companySetupSteps.length - 1;

/** The form gets the whole width; beside the hero panel it was cramped. */
function WideOnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh min-w-0 flex-col p-4 sm:p-6 lg:p-10">
      <div className="mx-auto w-full min-w-0 max-w-3xl">
        <AuthTopBar />
      </div>
      <div className="mx-auto w-full min-w-0 max-w-3xl flex-1 space-y-8 py-6 sm:py-10">
        {children}
      </div>
    </main>
  );
}

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

      <AuthHero />
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
  const form = useForm<CompanyFormValues>({
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
    // Each step is checked on Next, not as fields lose focus: an error
    // appearing on blur would move the Next button under the pointer.
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = form;
  const [stepIndex, setStepIndex] = useState(0);
  const step = companySetupSteps[stepIndex];
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Focus moves once the new step has rendered; the counter re-runs it.
  const focusTarget = useRef<"heading" | "error" | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const requestFocus = (target: "heading" | "error") => {
    focusTarget.current = target;
    setFocusRequest((count) => count + 1);
  };

  /** Focuses the first invalid control on screen, in reading order. */
  const focusFirstInvalid = useCallback(() => {
    const controls =
      formRef.current?.querySelectorAll<HTMLElement>("[name]") ?? [];
    for (const element of controls) {
      const name = element.getAttribute("name") as FieldPath<CompanyFormValues>;
      if (form.getFieldState(name).invalid) {
        element.focus();
        return;
      }
    }
  }, [form]);

  useEffect(() => {
    const target = focusTarget.current;
    focusTarget.current = null;
    if (target === "heading") headingRef.current?.focus();
    else if (target === "error") focusFirstInvalid();
  }, [focusRequest, focusFirstInvalid, stepIndex]);

  // Once a field shows an error, re-check it as it changes, so the error
  // clears as soon as it is fixed.
  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ name }) => {
          const field = name as FieldPath<CompanyFormValues> | undefined;
          if (field && form.getFieldState(field).invalid) {
            void form.trigger(field);
          }
        },
      }),
    [form],
  );

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

  async function next() {
    const valid = await form.trigger(step.fields);
    if (!valid) {
      focusFirstInvalid();
      return;
    }
    setStepIndex((index) => Math.min(index + 1, lastStep));
    requestFocus("heading");
  }

  function back() {
    setStepIndex((index) => Math.max(index - 1, 0));
    requestFocus("heading");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    // Enter in a field moves to the next step; only the last step creates.
    if (stepIndex < lastStep) {
      event.preventDefault();
      void next();
      return;
    }
    void handleSubmit(onSubmit, (formErrors) => {
      const firstWithErrors = companySetupSteps.findIndex((candidate) =>
        candidate.fields.some((field) => formErrors[field]),
      );
      setStepIndex(firstWithErrors === -1 ? lastStep : firstWithErrors);
      requestFocus("error");
    })(event);
  }

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
    <WideOnboardingShell>
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Company setup
        </p>
        <h1 className="type-page-title">Create your company</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Set up your organization&apos;s ContractFlow workspace. You&apos;ll be
          the administrator of the company you create.
        </p>
      </header>

      <Alert>
        <RiMailLine aria-hidden="true" />
        <AlertDescription>
          <span className="font-medium text-foreground">
            Were you invited to join a company?
          </span>{" "}
          You don&apos;t need to create one. Open the invitation link in your
          email and accept it while signed in as {currentUser.email}.
        </AlertDescription>
      </Alert>

      <form
        ref={formRef}
        onSubmit={submit}
        noValidate
        aria-label="Create your company"
        className="space-y-8"
      >
        <ol aria-label="Steps" className="hidden flex-wrap gap-2 text-sm sm:flex">
          {companySetupSteps.map((candidate, index) => (
            <li
              key={candidate.id}
              aria-current={index === stepIndex ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1",
                index === stepIndex
                  ? "border-primary bg-primary/10 font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <span className="tabular-nums" aria-hidden="true">
                {index + 1}
              </span>
              <span>
                {candidate.title}
                {index < stepIndex ? (
                  <span className="sr-only"> (done)</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>

        <div className="space-y-1">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-semibold focus-visible:outline-none"
          >
            Step {stepIndex + 1} of {companySetupSteps.length}: {step.title}
          </h2>
          <RequiredFieldsNote />
        </div>

        {serverError && (
          <Alert variant="destructive" className="break-words">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {step.id === "company" ? (
          <FormSection legend="Company and legal details">
            <FormGrid>
              <FormField
                id="name"
                label="Company name"
                required
                description="The name people know you by."
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
        ) : null}

        {step.id === "contact" ? (
          <FormSection legend="Contact">
            <FormGrid>
              <FormField
                id="email"
                label="Company email"
                required
                description="Other companies invite you to contracts at this address. You'll verify it after creating the company."
                error={errors.email?.message}
                className="sm:col-span-2"
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
                description="Enter a domain such as www.example.com or include https://."
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
        ) : null}

        {step.id === "address" ? (
          <FormSection legend="Business address and currency">
            <FormGrid>
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
                    name="defaultCurrencyCode"
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
        ) : null}

        <Separator />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SignOutAction className="self-center sm:self-auto" />
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {stepIndex > 0 ? (
              <Button type="button" variant="outline" size="xl" onClick={back}>
                Back
              </Button>
            ) : null}
            {stepIndex < lastStep ? (
              // A submit button, so Enter in any field moves on.
              <Button type="submit" size="xl">
                Next: {companySetupSteps[stepIndex + 1].title}
              </Button>
            ) : (
              <Button
                type="submit"
                size="xl"
                disabled={isSubmitting}
                aria-busy={isSubmitting || undefined}
              >
                {isSubmitting ? "Creating company…" : "Create company"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </WideOnboardingShell>
  );
}
