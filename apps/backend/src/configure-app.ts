import { ValidationPipe, type INestApplication } from "@nestjs/common";

/**
 * Applies the request-handling configuration that has to be identical wherever
 * the app is booted.
 *
 * This exists because it was not identical. `main.ts` installed
 * `forbidNonWhitelisted` and implicit conversion while `test/app.e2e-spec.ts`
 * built its own `ValidationPipe` with neither, so the suite that boots the real
 * `AppModule` was exercising a pipe the production process never uses: the 400
 * for an unknown property could not be tested at all, and query parameters
 * typed `@IsInt` (`page`, `month`, `year`) were coerced differently there than
 * in production. Anything that decides whether a request is accepted belongs
 * here, so a test cannot pass against a laxer server than the one that ships.
 *
 * CORS and Swagger stay in `bootstrap`: they need `ConfigService` and a listening
 * port, and neither can make a test pass that should fail.
 *
 * @param app - The Nest application, before `init()` or `listen()`.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix("api");

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip properties with no decorator instead of silently persisting them.
      whitelist: true,
      forbidNonWhitelisted: true,
      // Required for @Type()/implicit conversion: query params and JSON numbers
      // arrive as strings otherwise.
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
}
