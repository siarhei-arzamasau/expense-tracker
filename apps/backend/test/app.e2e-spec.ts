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

  it("answers 204 for a forgot-password request on an unregistered email", () => {
    // Same response as a known email — the point is that the caller cannot
    // tell the two cases apart.
    return request(app.getHttpServer())
      .post("/api/auth/forgot-password")
      .send({ email: "nobody-e2e@example.com" })
      .expect(204);
  });

  it("answers 400 for a reset-password token that fails DTO validation", () => {
    // Too short to be a real base64url(32 bytes) token — rejected by
    // @Length(43, 43) before this ever reaches UsersService.
    return request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ token: "not-a-real-token", password: "new-password123" })
      .expect(400);
  });

  it("answers 400 with the plan's exact message for a well-formed but unknown reset token", () => {
    // 43 characters, so it clears DTO validation and actually reaches
    // UsersService.resetPassword's token lookup.
    return request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ token: "a".repeat(43), password: "new-password123" })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({ message: "Reset link is invalid or has expired" });
      });
  });
});
