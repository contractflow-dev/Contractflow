import { z } from "zod";

/** The API's password policy for any new password (registration and reset). */
export const newPasswordSchema = z
  .string()
  .min(12, "At least 12 characters")
  .max(255)
  .regex(/[a-z]/, "Needs a lowercase letter")
  .regex(/[A-Z]/, "Needs an uppercase letter")
  .regex(/\d/, "Needs a number")
  .regex(/[^A-Za-z0-9]/, "Needs a symbol");

/** The rules as one sentence, shown under new-password fields. */
export const NEW_PASSWORD_RULES =
  "12–255 characters, including a lowercase letter, uppercase letter, number, and symbol.";

const registerFields = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(100),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().min(1, "Enter your last name").max(100),
  email: z.string().trim().email("Enter a valid email").max(254),
  phone: z.string().trim().max(100).optional(),
  timezone: z.string().min(1, "Select a timezone"),
  password: newPasswordSchema,
  confirmPassword: z.string().min(1, "Confirm your password"),
  acceptTerms: z.boolean().refine((v) => v, "You must accept the terms"),
});

const passwordFields = registerFields.pick({
  password: true,
  confirmPassword: true,
});

export const registerSchema = registerFields.refine(
  (v) => v.password === v.confirmPassword,
  {
    path: ["confirmPassword"],
    message: "Passwords do not match",
    // Check the match as soon as both passwords are valid, even while other
    // fields (such as the terms) still need attention.
    when: (payload) => passwordFields.safeParse(payload.value).success,
  },
);

export type RegisterValues = z.infer<typeof registerSchema>;
