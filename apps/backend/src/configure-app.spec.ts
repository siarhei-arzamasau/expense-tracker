import type { INestApplication } from "@nestjs/common";

import { configureApp } from "./configure-app";

describe("configureApp", () => {
  function appDouble() {
    return {
      setGlobalPrefix: jest.fn(),
      useGlobalPipes: jest.fn(),
    };
  }

  it("installs the /api prefix", () => {
    const app = appDouble();

    configureApp(app as unknown as INestApplication);

    expect(app.setGlobalPrefix).toHaveBeenCalledWith("api");
  });

  /**
   * The point of the function: these four options were set in main.ts and not in
   * the e2e harness, so the suite that boots the real AppModule could not catch a
   * regression in either the unknown-property 400 or query-param coercion.
   */
  it("installs the strict ValidationPipe both bootstraps need", () => {
    const app = appDouble();

    configureApp(app as unknown as INestApplication);

    expect(app.useGlobalPipes).toHaveBeenCalledWith(
      expect.objectContaining({
        isTransformEnabled: true,
        transformOptions: { enableImplicitConversion: true },
        validatorOptions: expect.objectContaining({
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      }),
    );
  });
});
