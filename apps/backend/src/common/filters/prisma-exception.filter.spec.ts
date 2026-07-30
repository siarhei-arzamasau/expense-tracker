import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  HttpException,
  Logger,
  NotFoundException,
  type ArgumentsHost,
  type INestApplication,
} from "@nestjs/common";
import { APP_FILTER, BaseExceptionFilter } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Prisma } from "@expense-tracker/database";
import request from "supertest";

import { PrismaExceptionFilter } from "./prisma-exception.filter";

/**
 * Builds the error Prisma raises for a rejected statement.
 *
 * @param code - Prisma error code, e.g. `"P2002"`.
 * @param meta - Constraint detail Prisma attaches; used to prove it stays out of
 * the response body.
 * @returns A real `PrismaClientKnownRequestError`, not a look-alike.
 */
function prismaError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Constraint failed", {
    code,
    clientVersion: "7.0.0",
    meta,
  });
}

/**
 * The filter answers by handing a translated exception to `BaseExceptionFilter`,
 * so that is what these assert on: it keeps the response body identical to every
 * other error the API returns instead of re-testing Nest's own serialisation.
 */
describe("PrismaExceptionFilter", () => {
  const host = {} as ArgumentsHost;
  let filter: PrismaExceptionFilter;
  let baseCatch: jest.SpiedFunction<typeof BaseExceptionFilter.prototype.catch>;

  function caughtException(): HttpException {
    const [exception] = baseCatch.mock.calls[0];
    if (!(exception instanceof HttpException)) {
      throw new Error("Expected the filter to delegate an HttpException");
    }
    return exception;
  }

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    baseCatch = jest
      .spyOn(BaseExceptionFilter.prototype, "catch")
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("answers 409 for a unique constraint violation", () => {
    filter.catch(prismaError("P2002"), host);

    const exception = caughtException();
    expect(exception).toBeInstanceOf(ConflictException);
    expect(exception.getStatus()).toBe(409);
    expect(baseCatch).toHaveBeenCalledWith(exception, host);
  });

  it("answers 400 for a foreign key violation", () => {
    filter.catch(prismaError("P2003"), host);

    expect(caughtException()).toBeInstanceOf(BadRequestException);
    expect(caughtException().getStatus()).toBe(400);
  });

  it("answers 404 when an update or delete matched no row", () => {
    filter.catch(prismaError("P2025"), host);

    expect(caughtException()).toBeInstanceOf(NotFoundException);
    expect(caughtException().getStatus()).toBe(404);
  });

  it("leaves an unrecognised code alone rather than guessing a 4xx", () => {
    // A connection or protocol failure is a server fault; reporting it as the
    // caller's mistake would be worse than the 500.
    const exception = prismaError("P1001");

    filter.catch(exception, host);

    expect(baseCatch).toHaveBeenCalledWith(exception, host);
  });

  it("keeps the failed constraint out of the response and in the log", () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    filter.catch(prismaError("P2002", { target: ["users_email_key"] }), host);

    expect(caughtException().message).not.toContain("users_email_key");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("users_email_key"));
  });
});

/**
 * The unit tests above stub `BaseExceptionFilter.catch`, which is the one thing
 * that cannot be taken on trust here: registered through `APP_FILTER`, this
 * filter receives its `HttpAdapterHost` by property injection, and without it
 * `super.catch` has no adapter to write a response with. So this boots a real
 * app over a controller that throws what Prisma throws, and asserts on the body
 * that comes back over HTTP.
 */
describe("PrismaExceptionFilter (registered in an application)", () => {
  @Controller("boom")
  class BoomController {
    @Get("unique")
    unique(): never {
      throw prismaError("P2002", { target: ["categories_userId_name_key"] });
    }

    @Get("unreachable")
    unreachable(): never {
      throw prismaError("P1001");
    }
  }

  let app: INestApplication;

  beforeAll(async () => {
    // Nest logs the 500 case at error level; keep the suite output readable.
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    const moduleRef = await Test.createTestingModule({
      controllers: [BoomController],
      providers: [{ provide: APP_FILTER, useClass: PrismaExceptionFilter }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it("answers a unique violation with 409 in the documented error shape", () => {
    return request(app.getHttpServer())
      .get("/boom/unique")
      .expect(409)
      .expect(({ body }) => {
        // The shape errorSchema() publishes: statusCode, message, error.
        expect(body).toMatchObject({
          statusCode: 409,
          message: "A record with those values already exists",
          error: "Conflict",
        });
        // The constraint name is log material, not response material.
        expect(JSON.stringify(body)).not.toContain("categories_userId_name_key");
      });
  });

  it("still answers 500 for a code it does not translate", () => {
    return request(app.getHttpServer()).get("/boom/unreachable").expect(500);
  });
});
