import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";
import { configureApp } from "./configure-app";

/**
 * Creates and starts the API process.
 *
 * Installs the `/api` prefix, strict request validation, CORS and the generated
 * OpenAPI document before listening. Configuration failures and database
 * connection failures reject the promise and abort startup.
 *
 * @returns A promise that settles once Nest is listening on `API_PORT`.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger("Bootstrap");

  // Shared with the e2e harness so both run the same pipe. See configure-app.ts.
  configureApp(app);

  // Without this, Nest never calls onModuleDestroy: the hooks only run from
  // app.close(), and nothing closes the app on a signal. `PrismaService`
  // implements OnModuleDestroy to drain the pg pool, so a SIGTERM from
  // `docker stop` or a deployment would otherwise kill the process with
  // connections still open and in-flight requests dropped.
  app.enableShutdownHooks();

  app.enableCors({
    origin: config.get<string>("WEB_ORIGIN", "http://localhost:3000"),
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Expense Tracker API")
    .setDescription("REST API for the expense tracker")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, () => SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get<number>("API_PORT", 3001);
  await app.listen(port);

  logger.log(`API listening on http://localhost:${port}/api`);
  logger.log(`Swagger UI on http://localhost:${port}/api/docs`);
}

void bootstrap();
