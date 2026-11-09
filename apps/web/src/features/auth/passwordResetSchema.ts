import { z } from "zod";
import { newPasswordSchema } from "./registerSchema";

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email("Enter a valid email address")),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

const passwordFields = z.object({
  password: newPasswordSchema,
  confirmPassword: z.string().min(1, "Confirm your new password"),
});

export const resetPasswordSchema = passwordFields.refine(
  (values) => values.password === values.confirmPassword,
  {
    path: ["confirmPassword"],
    message: "Passwords do not match",
    when: (payload) => passwordFields.safeParse(payload.value).success,
  },
);
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

/**
 * The API's answer to a token that is unknown, expired or already used. Any
 * other refusal is about the new password itself.
 */
export const RESET_LINK_INVALID_MESSAGE =
  "This password reset link is invalid, expired, or already used.";
