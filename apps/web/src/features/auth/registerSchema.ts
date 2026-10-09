import { z } from "zod";

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "Required"),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().min(1, "Required"),
    email: z.string().trim().email("Enter a valid email").max(254),
    phone: z.string().trim().max(100).optional(),
    timezone: z.string().min(1, "Select a timezone"),
    password: z
      .string()
      .min(12, "At least 12 characters")
      .max(255)
      .regex(/[a-z]/, "Needs a lowercase letter")
      .regex(/[A-Z]/, "Needs an uppercase letter")
      .regex(/\d/, "Needs a number")
      .regex(/[^A-Za-z0-9]/, "Needs a symbol"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    acceptTerms: z.boolean().refine((v) => v, "You must accept the terms"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type RegisterValues = z.infer<typeof registerSchema>;
