import { z } from "zod";

const emailSchema = z.email();

/** The field error for a required email address, or undefined when valid. */
export function emailFieldError(value: string): string | undefined {
  const email = value.trim();
  if (!email) return "Enter an email address.";
  return emailSchema.safeParse(email).success
    ? undefined
    : "Enter a valid email address.";
}
