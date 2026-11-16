import { z } from "zod";
import {
  splitPhoneNumber,
  validatePhoneNumber,
} from "@contractflow/contracts-schema/phone";

/**
 * Form state for a phone field: the country (ISO 3166-1 alpha-2, `""` until
 * chosen) and the number as typed, kept apart. They are combined into E.164
 * only on submit, through the country's numbering rules.
 */
export interface PhoneFieldValue {
  countryCode: string;
  nationalNumber: string;
}

export const EMPTY_PHONE: PhoneFieldValue = {
  countryCode: "",
  nationalNumber: "",
};

/**
 * The error to show for a phone field, or `undefined` when it is valid.
 * An empty optional number is valid whatever the country.
 */
export function phoneNumberError(
  value: PhoneFieldValue,
  { required }: { required: boolean },
): string | undefined {
  if (!value.nationalNumber.trim()) {
    return required ? "Enter a phone number." : undefined;
  }
  const result = validatePhoneNumber(value.countryCode, value.nationalNumber);
  return result.valid ? undefined : result.message;
}

/**
 * Zod schema for a phone field. Errors are reported on `nationalNumber`, the
 * control the field's label points to.
 *
 * The phone is its own nested object so its check runs whenever the field is
 * validated, even while other fields of a multi-step form are still empty.
 */
export function phoneFieldSchema({ required }: { required: boolean }) {
  return z
    .object({
      countryCode: z.string().trim(),
      nationalNumber: z.string().trim().max(40, "This number is too long."),
    })
    .superRefine((value, ctx) => {
      const message = phoneNumberError(value, { required });
      if (message) {
        ctx.addIssue({ code: "custom", path: ["nationalNumber"], message });
      }
    });
}

/**
 * The E.164 number to send to the API, or `""` for an empty optional field.
 * Call only after the schema has validated the value.
 */
export function phoneToE164(value: PhoneFieldValue): string {
  if (!value.nationalNumber.trim()) return "";
  const result = validatePhoneNumber(value.countryCode, value.nationalNumber);
  if (!result.valid) throw new Error(result.message);
  return result.e164;
}

/**
 * The phone field's starting value for a saved number. Numbers saved before
 * phone validation may lack a calling code; they are read in
 * `fallbackCountry`. `savedText` is set when the saved value could not be
 * read, so the form can say what was saved; it stays in the field to fix.
 */
export function phoneFieldFromSaved(
  saved: string | null | undefined,
  fallbackCountry?: string | null,
): PhoneFieldValue & { savedText?: string } {
  const parts = splitPhoneNumber(saved, fallbackCountry);
  return {
    countryCode: parts.countryCode,
    nationalNumber: parts.nationalNumber,
    savedText: parts.recognized ? undefined : (saved ?? "").trim(),
  };
}
