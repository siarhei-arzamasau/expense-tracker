import { AUTH_RESPONSE_SCHEMA } from "./auth.schema";
import { USER_SCHEMA } from "../users/user.schema";

describe("AUTH_RESPONSE_SCHEMA", () => {
  it("requires the token and composes the canonical public-user schema", () => {
    expect(AUTH_RESPONSE_SCHEMA.required).toEqual(["accessToken", "user"]);
    expect(AUTH_RESPONSE_SCHEMA.properties?.user).toBe(USER_SCHEMA);
    expect(AUTH_RESPONSE_SCHEMA.properties?.accessToken).toMatchObject({ type: "string" });
  });
});
