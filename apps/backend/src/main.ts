import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

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

  console.warn(`API listening on http://localhost:${port}/api`);
  console.warn(`Swagger UI on http://localhost:${port}/api/docs`);
}

void bootstrap();
