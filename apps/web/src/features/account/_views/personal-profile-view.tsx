"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { UpdateMyProfileRequest } from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  FormField,
  FormGrid,
  FormSection,
  RequiredFieldsNote,
} from "@/components/forms/form-field";
import { PhoneNumberInput } from "@/components/forms/phone-number-input";
import { PageHeader } from "@/components/page-header/page-header";
import { AccountShell } from "../AccountShell";
import { useTimeZoneOptions } from "@/hooks/use-time-zone-options";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
import { getApiErrorMessage } from "@/lib/apiError";
import { notifySuccess } from "@/lib/notify";
import {
  phoneFieldFromSaved,
  phoneFieldSchema,
  phoneToE164,
} from "@/lib/phone";
import {
  useGetCurrentUserQuery,
  useUpdateMyProfileMutation,
  type UserProfile,
} from "@/services/authApi";

/** The API's rules for the user's own profile (UpdateAppUserRequestDto). */
const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(100),
  middleName: z.string().trim().max(100),
  lastName: z.string().trim().min(1, "Enter your last name.").max(100),
  phone: phoneFieldSchema({ required: false }),
  timezone: z.string().min(1, "Select a time zone."),
});

type ProfileValues = z.infer<typeof profileSchema>;

export function PersonalProfileView() {
  return (
    <AccountShell>
      <PersonalProfile />
    </AccountShell>
  );
}

/**
 * The signed-in user's own profile. It reads and writes only `/users/me`,
 * whose user comes from the session, so nobody else's profile is reachable.
 */
export function PersonalProfile({
  fallbackCountry,
}: {
  /** Reads a saved number that lacks a calling code (tests only). */
  fallbackCountry?: string;
}) {
  const { data: user, error, isLoading, refetch } = useGetCurrentUserQuery();

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="My Account"
        title="Personal Profile"
        description="Your name, contact number and time zone, as other people in ContractFlow see them."
      />
      {isLoading ? (
        <Card>
          <CardContent
            role="status"
            aria-label="Loading your profile"
            className="space-y-4"
          >
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
          </CardContent>
        </Card>
      ) : error || !user ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {getApiErrorMessage(error, "Your profile could not be loaded.")}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <ProfileForm
          key={user.id}
          user={user}
          fallbackCountry={fallbackCountry}
        />
      )}
    </section>
  );
}

function initialValues(
  user: UserProfile,
  fallbackCountry: string | undefined,
): ProfileValues & { unreadablePhone?: string } {
  const { savedText, ...phone } = phoneFieldFromSaved(
    user.phoneNumber,
    fallbackCountry,
  );
  return {
    firstName: user.firstName ?? "",
    middleName: user.middleName ?? "",
    lastName: user.lastName ?? "",
    phone,
    timezone: user.timezone || "UTC",
    unreadablePhone: savedText,
  };
}

function ProfileForm({
  user,
  fallbackCountry,
}: {
  user: UserProfile;
  fallbackCountry?: string;
}) {
  const [{ unreadablePhone, ...defaults }] = useState(() =>
    initialValues(user, fallbackCountry),
  );
  const [updateProfile, { isLoading: saving }] = useUpdateMyProfileMutation();
  const [submitError, setSubmitError] = useState("");
  const timezones = useTimeZoneOptions();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isDirty, dirtyFields, isSubmitted },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });
  const phone = useWatch({ control, name: "phone" });
  const timezone = useWatch({ control, name: "timezone" });
  useUnsavedChangesWarning(isDirty && !saving);

  async function save(values: ProfileValues) {
    setSubmitError("");
    // Only what changed is sent, as the API expects.
    const changes: UpdateMyProfileRequest = {};
    if (dirtyFields.firstName) changes.firstName = values.firstName;
    if (dirtyFields.middleName) changes.middleName = values.middleName;
    if (dirtyFields.lastName) changes.lastName = values.lastName;
    if (dirtyFields.phone) changes.phoneNumber = phoneToE164(values.phone);
    if (dirtyFields.timezone) changes.timezone = values.timezone;
    try {
      await updateProfile(changes).unwrap();
      reset(values);
      notifySuccess("Profile updated");
    } catch (failure) {
      // The form keeps what was typed, to fix and save again.
      setSubmitError(
        getApiErrorMessage(failure, "Your profile could not be saved."),
      );
    }
  }

  // A stored zone this browser doesn't list stays selectable.
  const zoneOptions = timezones.includes(timezone)
    ? timezones
    : [timezone, ...timezones];

  return (
    <Card>
      <CardContent>
        <form
          onSubmit={handleSubmit(save)}
          noValidate
          aria-label="Personal profile"
          className="space-y-6"
        >
          {submitError ? (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}
          <RequiredFieldsNote />

          <FormSection legend="Your name">
            <FormGrid columns={2}>
              <FormField
                id="profile-firstName"
                label="First name"
                required
                error={errors.firstName?.message}
              >
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    {...register("firstName")}
                    autoComplete="given-name"
                  />
                )}
              </FormField>
              <FormField
                id="profile-middleName"
                label="Middle name"
                optional
                error={errors.middleName?.message}
              >
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    {...register("middleName")}
                    autoComplete="additional-name"
                  />
                )}
              </FormField>
              <FormField
                id="profile-lastName"
                label="Last name"
                required
                error={errors.lastName?.message}
              >
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    {...register("lastName")}
                    autoComplete="family-name"
                  />
                )}
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection legend="Contact">
            <FormGrid columns={2}>
              <FormField
                id="profile-email"
                label="Email"
                description="You sign in with this address. Changing it isn't available yet."
                className="sm:col-span-2"
              >
                {(controlProps) => (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      {...controlProps}
                      value={user.email}
                      readOnly
                      className="max-w-sm"
                    />
                    <Badge variant={user.emailVerifiedAt ? "info" : "outline"}>
                      {user.emailVerifiedAt ? "Verified" : "Not verified"}
                    </Badge>
                  </div>
                )}
              </FormField>
              <FormField
                id="profile-phoneNumber"
                label="Phone number"
                optional
                description={
                  unreadablePhone && phone.nationalNumber === unreadablePhone
                    ? `Previously saved as “${unreadablePhone}”. Select its country and check the number.`
                    : undefined
                }
                error={errors.phone?.nationalNumber?.message}
              >
                {(controlProps) => (
                  <PhoneNumberInput
                    {...controlProps}
                    value={phone}
                    onValueChange={(next) =>
                      setValue("phone", next, {
                        shouldDirty: true,
                        shouldValidate: isSubmitted,
                      })
                    }
                  />
                )}
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection legend="Time zone">
            <FormField
              id="profile-timezone"
              label="Time zone"
              required
              description="Dates and times across ContractFlow are shown in this zone."
              error={errors.timezone?.message}
              className="max-w-sm"
            >
              {(controlProps) => (
                <NativeSelect
                  {...controlProps}
                  className="w-full"
                  {...register("timezone")}
                >
                  {zoneOptions.map((zone) => (
                    <NativeSelectOption key={zone} value={zone}>
                      {zone}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          </FormSection>

          <Separator />
          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            {isDirty ? (
              <p className="text-sm text-muted-foreground sm:me-auto">
                You have unsaved changes.
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={!isDirty || saving}
              onClick={() => {
                setSubmitError("");
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isDirty || saving}
              aria-busy={saving || undefined}
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
