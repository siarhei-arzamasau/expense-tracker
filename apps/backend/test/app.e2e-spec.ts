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

  it("rejects an unauthenticated profile update", () => {
    return request(app.getHttpServer()).patch("/api/users/me").send({ name: "Nobody" }).expect(401);
  });

  it("rejects an unauthenticated account deletion", () => {
    return request(app.getHttpServer())
      .delete("/api/users/me")
      .send({ password: "password123" })
      .expect(401);
  });

  /**
   * Booting AppModule at all is the point: CqrsModule only discovers handlers in
   * onApplicationBootstrap, so a handler left out of the module's providers
   * cannot be caught by typechecking — only by putting a request on the bus.
   */
  it("reaches a users command handler through the bus", async () => {
    const email = `e2e-${Date.now().toString()}@example.com`;
    const password = "password123";

    const registered = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ email, password, name: "E2E User" })
      .expect(201);

    const { accessToken } = registered.body as { accessToken: string };

    await request(app.getHttpServer())
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Renamed" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ email, name: "Renamed" });
        expect(body).not.toHaveProperty("passwordHash");
      });

    // Clean up after ourselves, and exercise the delete path while doing it.
    await request(app.getHttpServer())
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ password })
      .expect(204);

    // Tokens are not revoked, but the user behind this one is gone — /auth/me
    // has to answer 401 rather than 404 so the frontend logs out.
    await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(401);
  });
});
