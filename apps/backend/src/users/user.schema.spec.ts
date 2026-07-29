import { USER_SCHEMA } from "./user.schema";

describe("USER_SCHEMA", () => {
  it("documents every public user field and keeps name nullable", () => {
    expect(USER_SCHEMA.required).toEqual(["id", "email", "name", "createdAt"]);
    expect(Object.keys(USER_SCHEMA.properties ?? {})).toEqual(["id", "email", "name", "createdAt"]);
    expect(USER_SCHEMA.properties?.name).toMatchObject({ type: "string", nullable: true });
    expect(USER_SCHEMA.properties).not.toHaveProperty("passwordHash");
  });
});
