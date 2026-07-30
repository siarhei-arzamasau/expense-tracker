# Architecture

This document describes the system boundaries, runtime topology, module responsibilities, and
cross-cutting design decisions of Expense Tracker. For endpoint-level details, see
[API reference](./api-reference.md). For persistence details, see
[database schema](./database-schema.md).

## System overview

Expense Tracker is a TypeScript monorepo containing a browser application, an HTTP API, and shared
library packages. PostgreSQL is the only stateful runtime dependency.

```text
Browser
  │
  │ HTTP/JSON + Bearer JWT
  ▼
Next.js frontend :3000
  │
  │ REST requests to /api
  ▼
NestJS backend :3001
  │
  │ Prisma Client + PostgreSQL driver adapter
  ▼
PostgreSQL :5432
```

The browser never connects to PostgreSQL and the frontend never imports the Prisma package. All
persistent data access passes through the backend.

## Repository boundaries

| Workspace                    | Package                              | Responsibility                                                                          |
| ---------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| `apps/frontend`              | `@expense-tracker/frontend`          | Next.js App Router UI, browser auth state, forms, and server-state caching.             |
| `apps/backend`               | `@expense-tracker/backend`           | NestJS REST API, validation, authentication, authorization, and business logic.         |
| `packages/shared`            | `@expense-tracker/shared`            | Framework-neutral request/response shapes, enums, pagination, and API route constants.  |
| `packages/database`          | `@expense-tracker/database`          | Prisma schema, migrations, generated client, seed data, and PostgreSQL adapter factory. |
| `packages/typescript-config` | `@expense-tracker/typescript-config` | Shared strict TypeScript configurations for libraries, NestJS, and Next.js.             |

The dependency graph is intentionally one-directional:

```text
apps/frontend ────────> packages/shared

apps/backend ─────────> packages/shared
      │
      └───────────────> packages/database

packages/shared ──────> no application or database workspace
packages/database ────> no application workspace
```

`packages/database` must remain a backend-only dependency. Keeping the generated Prisma client to
one CommonJS runtime consumer avoids ESM/CommonJS dual-format problems and prevents persistence
types from becoming the public API contract.

## Runtime composition

### Development processes

`pnpm dev` runs the Turborepo `dev` graph:

- `packages/shared` and `packages/database` compile their libraries in watch mode.
- NestJS runs in watch mode on `API_PORT`, defaulting to `3001`.
- Next.js runs on port `3000`.
- PostgreSQL runs separately through Docker Compose.

Turborepo builds dependency workspaces before starting application watchers. Prisma client
generation is a distinct cached task whose output is `packages/database/src/generated/**`.

### Backend bootstrap

`apps/backend/src/main.ts` is the HTTP composition root. At startup it:

1. Creates the Nest application from `AppModule`.
2. Calls `configureApp`, which applies the `/api` route prefix and the global `ValidationPipe` with
   transformation, whitelisting, and rejection of unknown properties.
3. Enables shutdown hooks, so Nest runs `PrismaService.onModuleDestroy` on a signal.
4. Enables CORS for `WEB_ORIGIN`, defaulting to `http://localhost:3000`.
5. Generates the OpenAPI document and mounts Swagger UI at `/api/docs`.
6. Listens on `API_PORT`, defaulting to `3001`.

Steps 1 and 2 are split deliberately. `apps/backend/src/configure-app.ts` holds everything that
decides whether a request is accepted, and `test/app.e2e-spec.ts` calls the same function, so the e2e
suite cannot pass against a laxer server than the one that ships.

`AppModule` globally loads configuration from the repository root `.env`, registers
`CqrsModule.forRoot()`, composes the Prisma, auth, users, transactions, and categories modules, and
registers two global providers — `PrismaExceptionFilter` via `APP_FILTER` and `LoggingInterceptor`
via `APP_INTERCEPTOR`. They live in the module rather than in `main.ts` so that every bootstrap,
including the e2e harness, gets them without repeating the registration. The `.env` path is anchored
to the compiled module location because the backend can be started from different working
directories.

### Configuration ownership

The runtime intentionally uses two environment files:

- Root `.env`: Docker Compose, Prisma CLI, seed scripts, and NestJS.
- `apps/frontend/.env.local`: Next.js and its browser-facing API URL.

The frontend API base URL includes `/api`; the shared `API_ROUTES` constants contain only the path
below that prefix. This makes `NEXT_PUBLIC_API_URL + API_ROUTES.*` the complete endpoint URL.

## Backend architecture

### Module map

| Module               | Main responsibilities                                                                                                        | Data-access style                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `AuthModule`         | Register, log in, authenticate JWTs, expose current user, and initiate/reset passwords.                                      | Uses users commands and queries through the CQRS buses.                                   |
| `UsersModule`        | Account creation, credential verification, profile updates, password changes, account deletion, and reset-token persistence. | CQRS handlers call `UsersService`; repositories isolate user and reset-token persistence. |
| `TransactionsModule` | Transaction CRUD, filtering, pagination, and monthly aggregation.                                                            | `TransactionsService` injects `PrismaService` directly.                                   |
| `CategoriesModule`   | Category CRUD, uniqueness, usage counts, and safe deletion.                                                                  | `CategoriesService` injects `PrismaService` directly.                                     |
| `PrismaModule`       | One application-wide Prisma client and connection lifecycle.                                                                 | Connects at module initialization and disconnects at shutdown.                            |

The users module has the strongest internal boundary because it handles password hashes. Its
commands and queries are its public application surface; `UsersService` is not exported for direct
use by `AuthModule`. Categories and transactions deliberately use simpler service-to-Prisma flows.

### Request lifecycle

A typical protected request follows this path:

```text
HTTP request
  │
  ├─ LoggingInterceptor starts timing the request
  ├─ JwtAuthGuard validates the bearer token
  ├─ CurrentUser decorator exposes the authenticated user id
  ├─ ValidationPipe validates and transforms params/query/body DTOs
  ▼
Controller
  ▼
Service or CQRS command/query handler
  ▼
PrismaService
  ▼
PostgreSQL
  ▼
DTO mapping to JSON-safe values
```

Errors render as `statusCode`, `message`, and usually `error`. `PrismaExceptionFilter` is the only
custom filter and it preserves that shape: it translates the three Prisma constraint failures a
request can provoke — P2002 to 409, P2003 to 400, P2025 to 404 — into the matching `HttpException`
and lets Nest's built-in filter write the body. It exists because every check-then-write path
(category and user uniqueness, the transaction's category check) answered a bare 500 when a
concurrent request won the race, for a case the endpoint documents as 409 or 400. A Prisma code the
filter does not recognise is still a 500, deliberately.

`LoggingInterceptor` writes one line per request — method, path, status, duration — and reads no
body, headers, or route parameters, because bodies here carry plaintext passwords and reset tokens.
Note that interceptors run before exception filters, so its failure branch reports the error as
thrown while the filter logs the status it mapped to.

### Authentication flow

Registration and login both return an `AuthResponse` containing an access token and a public user:

```text
AuthController
  ▼
AuthService
  ├─ command/query bus ──> Users handlers ──> UsersService
  └─ JwtService signs { sub, email }
```

`JwtStrategy` validates tokens with `JWT_SECRET`. Protected controllers use `JwtAuthGuard`; the
user id always comes from the token, never from request data.

Password reset is intentionally development-oriented:

1. A reset request enters the users command bus.
2. `UsersService` deletes older tokens and creates a 32-byte random token.
3. Only the SHA-256 digest is persisted.
4. The raw token is placed in a URL based on `WEB_APP_URL` and logged by the backend.
5. Resetting the password atomically updates the password hash and deletes all reset tokens for the
   user.

Reset tokens expire after 60 minutes. The same response is used for known and unknown emails, and
the same error is used for unknown, expired, and already-consumed tokens.

### Authorization and ownership

The application is multi-user even though it has no organizations or roles. Ownership is enforced
at every data-access boundary:

- Controllers obtain `userId` from the authenticated token.
- Transaction and category queries include `userId` in their filters.
- Another user's object id is reported as not found instead of forbidden.
- A transaction can reference only a category owned by the same user.
- Update and delete operations are scoped so they cannot mutate another user's row.

This is a security invariant. New queries and mutations must preserve it.

### Validation and transport contracts

Request validation lives in runtime NestJS DTO classes using `class-validator`. Shared package
interfaces describe transport shapes but contain no validation decorators.

This distinction exists because:

- Interfaces disappear at runtime and cannot drive `ValidationPipe` or Swagger reflection.
- The frontend needs framework-neutral TypeScript shapes.
- Validation policy belongs at the server boundary.

Where possible, backend DTOs implement the shared request shape. `FindTransactionsQueryDto`, for
example, implements `TransactionQuery`, so removing a supported filter on either side creates a
type error.

### Persistence boundary

`PrismaService` extends the generated `PrismaClient`. Prisma 7 requires a driver adapter, so the
client is constructed with `createPgAdapter(DATABASE_URL)` from `packages/database`. The service
connects during Nest module initialization and fails startup if configuration or database access is
invalid.

Prisma entities are never returned directly. Services map records into DTOs so that:

- Password hashes never leave `UsersService`.
- `Date` values become ISO-8601 strings.
- Decimal money values become fixed two-decimal strings.
- Internal relation and aggregate fields do not leak into the API.

## Frontend architecture

### Route groups

The App Router is divided into public and protected surfaces:

| Route                | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| `/login`             | Login and registration.                                  |
| `/forgot-password`   | Request a development reset link.                        |
| `/reset-password`    | Consume a reset token.                                   |
| `/terms`, `/privacy` | Public informational pages.                              |
| `/`                  | Authenticated monthly dashboard.                         |
| `/transactions`      | Authenticated transaction history and filters.           |
| `/categories`        | Authenticated category management.                       |
| `/profile`           | Authenticated profile, password, and account management. |

The `(app)` route group applies `AppShell` to authenticated pages without adding a URL segment.
`AppShell` checks for a locally stored token, loads `/auth/me`, and renders navigation only after
the current account has been verified.

### Server-state management

TanStack Query owns API-backed state. Query definitions live under `src/lib/queries` and use stable
keys for current user, categories, transaction lists, and monthly summaries.

Important cache rules:

- Paginated transaction queries use `keepPreviousData` so controls remain mounted while a new page
  loads.
- Category changes invalidate both category and transaction data because transactions embed a
  category snapshot.
- Unauthorized queries are not retried.
- The default stale time is 30 seconds and focus refetching is disabled.

Transaction list filters live in URL query parameters. `readTransactionQuery` treats the address
bar as untrusted input and normalizes it before issuing an API request.

### API client and session behavior

`src/lib/api-client.ts` is the single fetch wrapper. It:

- Prefixes paths with `NEXT_PUBLIC_API_URL`.
- Adds JSON headers.
- Adds the bearer token when present.
- Converts Nest error bodies into `ApiError`.
- Treats `204 No Content` as `undefined` instead of parsing JSON.
- Expires the local session when an authenticated request returns `401`.

The token is stored in `localStorage` by `authStorage`. An unauthorized event clears the query
cache and performs a hard redirect to `/login`. Voluntary logout uses `useLogout` to clear the token
and cache before navigation.

## Cross-cutting data decisions

### Money

PostgreSQL stores amounts as `Decimal(12, 2)`. Create/update requests accept a positive JavaScript
number with at most two decimal places, but responses expose money as a string such as `"82.40"`.
The transaction type carries the direction (`INCOME` or `EXPENSE`); amounts are never negative.

### Dates

API timestamps are ISO-8601 strings. Monthly summaries use half-open UTC ranges: the first instant
of the requested month is inclusive and the first instant of the next month is exclusive.

### Pagination

Transaction pages are 1-based and contain 10 items. Results are ordered by transaction date
descending, then id descending for stable ties. `totalPages` is zero for an empty filtered result.

### Nullable updates

Partial updates distinguish omitted fields from explicit `null` values:

- Omitted means keep the existing value.
- `name: null` clears a user display name.
- `color: null` or `icon: null` clears category presentation metadata.
- `description: null` clears a transaction description.

## Build and module strategy

`packages/shared` and `packages/database` compile to `dist` and are consumed as built output. Nest
compiles its own source to CommonJS. The generated Prisma client is explicitly configured as
CommonJS because the backend is its only runtime consumer. Next.js transpiles the shared workspace
package through `transpilePackages`.

Turborepo owns Prisma generation before builds, typechecks, and tests. The database package's
`build` script remains plain `tsc`; embedding generation there would duplicate the task and make
cache correctness depend on untracked generated sources.

## Deliberate security limitations

This is a learning project, not a production-hardened financial system:

- JWTs are stored in `localStorage`, so an XSS vulnerability could read them.
- There is no refresh-token rotation or server-side access-token revocation.
- Password changes and resets do not revoke already-issued access tokens.
- Authentication endpoints have no rate limiting.
- Password-reset links are logged rather than emailed.
- Expired reset-token rows have no scheduled cleanup process.

Production work should address these boundaries before adding real user or financial data.

## Where to make changes

| Change                            | Primary locations                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| Add or rename an API route        | `packages/shared/src/constants/api-routes.ts`, backend controller, frontend query function     |
| Add a request or response field   | `packages/shared/src/types`, backend DTO/service/schema, frontend consumer                     |
| Add a database column             | `packages/database/prisma/schema.prisma`, migration, shared DTOs, backend mapping, frontend UI |
| Add a user operation              | Users command/query class, handler registry, `UsersService`, controller, tests                 |
| Add transaction/category behavior | Corresponding controller, DTO, service, shared type, query hook, tests                         |
| Change runtime configuration      | `.env.example`, `apps/frontend/.env.example`, `turbo.json`, consuming module, README/docs      |
