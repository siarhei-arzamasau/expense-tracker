import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../src/app.module";

/**
 * Boots the real app, so it needs a reachable database:
 *   docker compose up -d && pnpm db:migrate
 * Run with `pnpm test:e2e`. `pnpm test` runs the unit specs only.
 */
describe("App (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated access to /api/expenses", () => {
    return request(app.getHttpServer()).get("/api/expenses").expect(401);
  });

  it("rejects a registration with a too-short password", () => {
    return request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ email: "someone@example.com", password: "short" })
      .expect(400);
  });
});
