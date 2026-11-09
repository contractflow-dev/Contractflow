import { describe, expect, it } from "vitest";
import { registerSchema } from "./registerSchema";

const valid = {
  firstName: "Ada",
  middleName: "",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "",
  timezone: "Africa/Lagos",
  password: "Correct-Horse-9",
  confirmPassword: "Correct-Horse-9",
  acceptTerms: true,
};

function messages(values: Record<string, unknown>) {
  const result = registerSchema.safeParse(values);
  return result.success
    ? {}
    : Object.fromEntries(
        result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
      );
}

describe("registerSchema", () => {
  it("accepts a complete registration", () => {
    expect(messages(valid)).toEqual({});
  });

  it("keeps the API's password rules", () => {
    expect(messages({ ...valid, password: "Short-1", confirmPassword: "Short-1" }))
      .toMatchObject({ password: "At least 12 characters" });
    expect(
      messages({ ...valid, password: "alllowercase-123", confirmPassword: "alllowercase-123" }),
    ).toMatchObject({ password: "Needs an uppercase letter" });
  });

  it("reports mismatched passwords even while other fields need attention", () => {
    expect(
      messages({
        ...valid,
        firstName: "",
        acceptTerms: false,
        confirmPassword: "Correct-Horse-8",
      }),
    ).toEqual({
      firstName: "Enter your first name",
      acceptTerms: "You must accept the terms",
      confirmPassword: "Passwords do not match",
    });
  });

  it("doesn't report a mismatch until the password itself is valid", () => {
    expect(
      messages({ ...valid, password: "short", confirmPassword: "other" }),
    ).not.toHaveProperty("confirmPassword", "Passwords do not match");
  });
});
