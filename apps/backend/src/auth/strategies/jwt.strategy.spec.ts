import { ConfigService } from "@nestjs/config";

import { JwtStrategy } from "./jwt.strategy";

describe("JwtStrategy", () => {
  it("fails fast through ConfigService when the signing secret is unavailable", () => {
    const config = { getOrThrow: jest.fn(() => "test-secret") } as unknown as ConfigService;

    new JwtStrategy(config);

    expect(config.getOrThrow).toHaveBeenCalledWith("JWT_SECRET");
  });

  it("projects verified claims to the authenticated-user shape", () => {
    const strategy = new JwtStrategy({
      getOrThrow: jest.fn(() => "test-secret"),
    } as unknown as ConfigService);

    const payload = {
      sub: "018f0000-0000-7000-8000-000000000001",
      email: "demo@example.com",
      iat: 1,
      exp: 2,
    } as unknown as Parameters<JwtStrategy["validate"]>[0];

    expect(strategy.validate(payload)).toEqual({
      id: "018f0000-0000-7000-8000-000000000001",
      email: "demo@example.com",
    });
  });
});
