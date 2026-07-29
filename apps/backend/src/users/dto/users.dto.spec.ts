import { validate } from "class-validator";

import { ChangePasswordDto } from "./change-password.dto";
import { DeleteAccountDto } from "./delete-account.dto";
import { UpdateProfileDto } from "./update-profile.dto";

async function errorsFor<T extends object>(Type: new () => T, values: Partial<T>) {
  return validate(Object.assign(new Type(), values));
}

describe("user DTOs", () => {
  it("requires the current password when changing it", async () => {
    const errors = await errorsFor(ChangePasswordDto, {
      currentPassword: "",
      newPassword: "new-password",
    });

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: "currentPassword" })]),
    );
  });

  it.each([
    ["a 7-character new password", "a".repeat(7)],
    ["a 73-character new password", "a".repeat(73)],
  ])("rejects %s", async (_label, newPassword) => {
    const errors = await errorsFor(ChangePasswordDto, {
      currentPassword: "password123",
      newPassword,
    });

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: "newPassword" })]),
    );
  });

  it("requires a non-empty password before account deletion", async () => {
    const errors = await errorsFor(DeleteAccountDto, { password: "" });

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: "password" })]),
    );
  });

  it("accepts null as the explicit request to clear a display name", async () => {
    await expect(errorsFor(UpdateProfileDto, { name: null })).resolves.toHaveLength(0);
  });

  it("rejects invalid email syntax and names longer than 100 characters", async () => {
    const errors = await errorsFor(UpdateProfileDto, {
      email: "not-an-email",
      name: "a".repeat(101),
    });

    expect(errors.map(({ property }) => property)).toEqual(
      expect.arrayContaining(["email", "name"]),
    );
  });

  it("leaves the at-least-one-field rule to UsersService", async () => {
    // An empty object is valid at the transport layer; UsersService owns the
    // cross-field rule and answers it with the endpoint's canonical 400.
    await expect(errorsFor(UpdateProfileDto, {})).resolves.toHaveLength(0);
  });
});
