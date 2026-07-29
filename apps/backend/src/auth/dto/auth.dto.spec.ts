import { validate } from "class-validator";

import { ForgotPasswordDto } from "./forgot-password.dto";
import { LoginDto } from "./login.dto";
import { RegisterDto } from "./register.dto";
import { ResetPasswordDto } from "./reset-password.dto";

async function errorsFor<T extends object>(Type: new () => T, values: Partial<T>) {
  return validate(Object.assign(new Type(), values));
}

describe("authentication DTOs", () => {
  it.each([
    [ForgotPasswordDto, { email: "not-an-email" }],
    [LoginDto, { email: "not-an-email", password: "password123" }],
    [RegisterDto, { email: "not-an-email", password: "password123" }],
  ])("rejects invalid email syntax in %s", async (Type, values) => {
    await expect(errorsFor(Type, values)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: "email" })]),
    );
  });

  it.each([
    ["a 7-character registration password", "a".repeat(7)],
    ["a 73-character registration password", "a".repeat(73)],
  ])("rejects %s", async (_label, password) => {
    const errors = await errorsFor(RegisterDto, { email: "demo@example.com", password });

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: "password" })]),
    );
  });

  it("rejects a display name longer than 100 characters", async () => {
    const errors = await errorsFor(RegisterDto, {
      email: "demo@example.com",
      password: "password123",
      name: "a".repeat(101),
    });

    expect(errors).toEqual(expect.arrayContaining([expect.objectContaining({ property: "name" })]));
  });

  it("requires a non-empty login password", async () => {
    const errors = await errorsFor(LoginDto, { email: "demo@example.com", password: "" });

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: "password" })]),
    );
  });

  it.each([
    ["a 42-character token", "a".repeat(42)],
    ["a 44-character token", "a".repeat(44)],
  ])("rejects %s before reset-token lookup", async (_label, token) => {
    const errors = await errorsFor(ResetPasswordDto, { token, password: "password123" });

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: "token" })]),
    );
  });

  it("accepts the exact reset-token and password boundaries", async () => {
    await expect(
      errorsFor(ResetPasswordDto, { token: "a".repeat(43), password: "b".repeat(72) }),
    ).resolves.toHaveLength(0);
  });
});
