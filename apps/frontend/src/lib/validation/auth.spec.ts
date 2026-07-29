import { describe, expect, it } from "vitest";

import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "./auth";

describe("authentication validation", () => {
  it("requires valid login credentials", () => {
    expect(loginSchema.safeParse({ email: "bad", password: "" }).success).toBe(false);
    expect(
      loginSchema.safeParse({ email: "demo@example.com", password: "password123" }).success,
    ).toBe(true);
  });

  it.each([
    ["a 7-character password", "a".repeat(7)],
    ["a 73-character password", "a".repeat(73)],
  ])("rejects registration with %s", (_label, password) => {
    expect(
      registerSchema.safeParse({
        email: "demo@example.com",
        password,
        confirmPassword: password,
        acceptTerms: true,
      }).success,
    ).toBe(false);
  });

  it("requires matching registration passwords and accepted terms", () => {
    const result = registerSchema.safeParse({
      email: "demo@example.com",
      password: "password123",
      confirmPassword: "different123",
      acceptTerms: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map(({ path }) => path[0])).toEqual(
        expect.arrayContaining(["confirmPassword", "acceptTerms"]),
      );
    }
  });

  it("accepts a valid optional registration name at the backend boundary", () => {
    expect(
      registerSchema.safeParse({
        name: "Demo User",
        email: "demo@example.com",
        password: "password123",
        confirmPassword: "password123",
        acceptTerms: true,
      }).success,
    ).toBe(true);
  });

  it("validates password-recovery email syntax", () => {
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("requires matching reset passwords within the 8-72 character bounds", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "password123",
        confirmPassword: "different123",
      }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({
        password: "password123",
        confirmPassword: "password123",
      }).success,
    ).toBe(true);
  });
});
