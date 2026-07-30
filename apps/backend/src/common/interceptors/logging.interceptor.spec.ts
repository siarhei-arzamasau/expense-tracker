import { Logger, NotFoundException, type CallHandler, type ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of, throwError } from "rxjs";

import { LoggingInterceptor } from "./logging.interceptor";

describe("LoggingInterceptor", () => {
  const interceptor = new LoggingInterceptor();
  let log: jest.SpiedFunction<typeof Logger.prototype.log>;
  let warn: jest.SpiedFunction<typeof Logger.prototype.warn>;
  let error: jest.SpiedFunction<typeof Logger.prototype.error>;

  /**
   * A request carrying a password in its body, so the assertions below can show
   * the interceptor never reads one.
   */
  function context(): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method: "POST",
          url: "/auth/login",
          originalUrl: "/api/auth/login",
          body: { email: "demo@example.com", password: "password123" },
          headers: { authorization: "Bearer a-live-token" },
        }),
        getResponse: () => ({ statusCode: 201 }),
      }),
    } as unknown as ExecutionContext;
  }

  function handler(result: ReturnType<CallHandler["handle"]>): CallHandler {
    return { handle: () => result };
  }

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("logs method, prefixed path, status and duration for a successful request", async () => {
    await lastValueFrom(interceptor.intercept(context(), handler(of({ id: "1" }))));

    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^POST \/api\/auth\/login 201 \d+ms$/));
  });

  it("passes the handler's value through untouched", async () => {
    const value = { id: "1" };

    await expect(lastValueFrom(interceptor.intercept(context(), handler(of(value))))).resolves.toBe(
      value,
    );
  });

  it("logs an HttpException at warn, with its status", async () => {
    const failing = interceptor.intercept(
      context(),
      handler(throwError(() => new NotFoundException("Transaction not found"))),
    );

    await expect(lastValueFrom(failing)).rejects.toBeInstanceOf(NotFoundException);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^POST \/api\/auth\/login 404 \d+ms$/));
    expect(error).not.toHaveBeenCalled();
  });

  it("logs an unexpected failure at error, with its stack", async () => {
    const thrown = new Error("pool exhausted");
    const failing = interceptor.intercept(context(), handler(throwError(() => thrown)));

    await expect(lastValueFrom(failing)).rejects.toBe(thrown);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("POST /api/auth/login failed in"),
      thrown.stack,
    );
  });

  /**
   * The reason this interceptor reads three named fields off the request instead
   * of the request itself: bodies here carry plaintext passwords and reset
   * tokens, and the Authorization header carries a live credential.
   */
  it("logs no credential from the body or the headers", async () => {
    await lastValueFrom(interceptor.intercept(context(), handler(of({}))));

    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain("password123");
    expect(logged).not.toContain("a-live-token");
  });
});
