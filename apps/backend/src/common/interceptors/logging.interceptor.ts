import {
  HttpException,
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { tap, type Observable } from "rxjs";

/** The request fields this interceptor reads. Express supplies all three. */
interface LoggedRequest {
  method: string;
  url: string;
  /** Express's pre-router URL, which keeps the `/api` prefix. */
  originalUrl?: string;
}

/**
 * One log line per request: method, path, status, duration.
 *
 * Registered through `APP_INTERCEPTOR` in `app.module.ts`, so it covers every
 * route without a decorator on any controller.
 *
 * **It logs no request body, no headers and no route parameters, on purpose.**
 * Bodies here carry plaintext passwords (`/auth/login`, `/users/me/password`)
 * and single-use reset tokens (`/auth/reset-password`), and the `Authorization`
 * header carries a live bearer token. The URL is safe by comparison — the
 * documented query parameters are filters and page numbers — but that is a
 * property of the current routes, so a future endpoint taking a credential in
 * the query string needs this decision revisited rather than assumed.
 *
 * Note the ordering against `PrismaExceptionFilter`: exception filters run
 * *after* interceptors, so the failure branch below sees the error as thrown,
 * before any translation. It therefore reports what broke rather than a status
 * that may since have been mapped, and the filter logs the status it chose.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  /**
   * Times the handler and logs how it finished.
   *
   * @param context - Execution context for the current request.
   * @param next - The rest of the handler chain.
   * @returns The handler's stream, unmodified.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const { method, url, originalUrl } = http.getRequest<LoggedRequest>();
    const path = originalUrl ?? url;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const { statusCode } = http.getResponse<{ statusCode: number }>();
          this.logger.log(`${method} ${path} ${String(statusCode)} ${this.since(startedAt)}`);
        },
        error: (error: unknown) => {
          // An HttpException is an expected outcome — a 401 or a 404 is the API
          // working — so it logs at warn. Anything else is a fault.
          if (error instanceof HttpException) {
            this.logger.warn(
              `${method} ${path} ${String(error.getStatus())} ${this.since(startedAt)}`,
            );
            return;
          }

          this.logger.error(
            `${method} ${path} failed in ${this.since(startedAt)}`,
            error instanceof Error ? error.stack : String(error),
          );
        },
      }),
    );
  }

  /**
   * Formats elapsed time for a log line.
   *
   * @param startedAt - Epoch milliseconds captured before the handler ran.
   * @returns The elapsed duration, e.g. `"12ms"`.
   */
  private since(startedAt: number): string {
    return `${String(Date.now() - startedAt)}ms`;
  }
}
