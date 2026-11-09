import { describe, expect, it } from "vitest";
import { forgotPasswordSchema, resetPasswordSchema } from "./passwordResetSchema";

function messages(schema: typeof resetPasswordSchema | typeof forgotPasswordSchema, values: unknown) {
  const result = schema.safeParse(values);
  return result.success
    ? {}
    : Object.fromEntries(
        result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
      );
}

describe("forgotPasswordSchema", () => {
  it("requires a valid email and normalises it", () => {
    expect(messages(forgotPasswordSchema, { email: "" })).toEqual({
      email: "Enter a valid email address",
    });
    expect(messages(forgotPasswordSchema, { email: "not-an-email" })).toEqual({
      email: "Enter a valid email address",
    });
    expect(forgotPasswordSchema.parse({ email: "  Ada@Example.COM " })).toEqual({
      email: "ada@example.com",
    });
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a strong password typed twice", () => {
    expect(
      messages(resetPasswordSchema, {
        password: "New-Password-123",
        confirmPassword: "New-Password-123",
      }),
    ).toEqual({});
  });

  it("applies the same password rules as registration", () => {
    expect(
      messages(resetPasswordSchema, { password: "Short-1!", confirmPassword: "Short-1!" }),
    ).toMatchObject({ password: "At least 12 characters" });
    expect(
      messages(resetPasswordSchema, {
        password: "no-symbols-or-caps1",
        confirmPassword: "no-symbols-or-caps1",
      }),
    ).toMatchObject({ password: "Needs an uppercase letter" });
  });

  it("requires the confirmation to match", () => {
    expect(
      messages(resetPasswordSchema, {
        password: "New-Password-123",
        confirmPassword: "New-Password-124",
      }),
    ).toEqual({ confirmPassword: "Passwords do not match" });
    expect(
      messages(resetPasswordSchema, { password: "New-Password-123", confirmPassword: "" }),
    ).toEqual({ confirmPassword: "Confirm your new password" });
  });
});
