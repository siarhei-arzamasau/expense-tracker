# Developer Guide

This guide covers local setup, daily commands, repository conventions, safe extension patterns,
testing, and troubleshooting. Read [architecture](./architecture.md) before changing boundaries,
[API reference](./api-reference.md) before changing HTTP behavior, and
[database schema](./database-schema.md) before changing persistence.

## Prerequisites

| Requirement | Version or expectation                                    |
| ----------- | --------------------------------------------------------- |
| Node.js     | 24 or newer; `.nvmrc` pins `24.18.0`.                     |
| pnpm        | 11 or newer; `package.json` pins `11.15.1`.               |
| Docker      | Docker Engine/Desktop with Compose v2.                    |
| Local ports | `3000`, `3001`, and `5432` available unless reconfigured. |

Using `nvm`:

```bash
nvm install
nvm use
node --version
pnpm --version
```

pnpm 11 blocks dependency build scripts unless allowed. The repository's
`pnpm-workspace.yaml` explicitly permits the native/install steps required by Prisma, Argon2,
esbuild, Sharp, and related platform packages. Do not replace `allowBuilds` with pnpm 10's obsolete
`onlyBuiltDependencies` key.

## First-time setup

Run all commands from the repository root:

```bash
# Backend, Prisma, Docker, and seed configuration.
cp .env.example .env

# Browser-visible Next.js configuration.
cp apps/frontend/.env.example apps/frontend/.env.local

pnpm install
docker compose up -d --wait

pnpm db:generate
pnpm db:migrate
pnpm db:seed

pnpm dev
```

Open:

- Frontend: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:3001/api](http://localhost:3001/api)
- Swagger UI: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

Seeded credentials:

```text
demo@example.com / password123
```

On a fresh clone, unresolved imports from `packages/database/src/generated` are expected until
`pnpm db:generate` runs. That directory is build output and is intentionally gitignored.

## Environment configuration

### Root `.env`

| Variable            | Default/example                                                             | Used by               | Notes                                                           |
| ------------------- | --------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------- |
| `POSTGRES_USER`     | `expense`                                                                   | Docker Compose        | Local database user.                                            |
| `POSTGRES_PASSWORD` | `expense`                                                                   | Docker Compose        | Local database password. Change outside development.            |
| `POSTGRES_DB`       | `expense_tracker`                                                           | Docker Compose        | Local database name.                                            |
| `POSTGRES_PORT`     | `5432`                                                                      | Docker Compose        | Host port mapped to container port 5432.                        |
| `DATABASE_URL`      | `postgresql://expense:expense@localhost:5432/expense_tracker?schema=public` | Prisma, seed, backend | Required; must match the Docker settings.                       |
| `JWT_SECRET`        | `dev-only-change-me`                                                        | Backend               | Required; replace outside local development.                    |
| `JWT_EXPIRES_IN`    | `7d`                                                                        | Backend               | Any supported JWT duration such as `15m`, `1h`, or `7d`.        |
| `API_PORT`          | `3001`                                                                      | Backend               | NestJS listen port.                                             |
| `WEB_ORIGIN`        | `http://localhost:3000`                                                     | Backend               | Exact browser origin allowed by CORS.                           |
| `WEB_APP_URL`       | `http://localhost:3000`                                                     | Backend               | Base URL for logged password-reset links; add when non-default. |

Generate a non-development JWT secret with:

```bash
openssl rand -base64 32
```

### Frontend `.env.local`

| Variable              | Default/example             | Notes                                                                   |
| --------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api` | Browser API base; must include `/api`. Publicly embedded at build time. |

Never place a secret in a `NEXT_PUBLIC_` variable.

### Coupled settings

- Changing PostgreSQL user, password, database, or host port requires updating `DATABASE_URL`.
- Changing `API_PORT` requires updating `NEXT_PUBLIC_API_URL`.
- Changing the frontend origin requires updating both `WEB_ORIGIN` and `WEB_APP_URL`.
- Restart the affected process after changing its environment file.

Docker applies `POSTGRES_*` initialization values only when the database volume is first created.
Changing `.env` later does not rewrite the existing database role or database.

## Daily development

### Start and stop

```bash
docker compose up -d --wait
pnpm dev
```

`pnpm dev` keeps the package builds, backend, and frontend in watch mode. Stop the application
watchers with `Ctrl+C` and stop PostgreSQL without deleting its volume with:

```bash
docker compose down
```

### Root commands

| Command             | Purpose                                                               |
| ------------------- | --------------------------------------------------------------------- |
| `pnpm dev`          | Run frontend and backend with workspace watchers.                     |
| `pnpm build`        | Generate Prisma code and build every workspace.                       |
| `pnpm typecheck`    | Type-check every workspace.                                           |
| `pnpm lint`         | Run Oxlint in every workspace.                                        |
| `pnpm lint:fix`     | Apply safe Oxlint fixes repository-wide.                              |
| `pnpm format`       | Format tracked source with Oxfmt.                                     |
| `pnpm format:check` | Check formatting without modifying files.                             |
| `pnpm test`         | Run backend Jest and frontend Vitest suites.                          |
| `pnpm clean`        | Clean workspace outputs and root `node_modules`; reinstall afterward. |
| `pnpm db:generate`  | Generate the Prisma client.                                           |
| `pnpm db:migrate`   | Create and apply a development migration.                             |
| `pnpm db:deploy`    | Apply existing checked-in migrations.                                 |
| `pnpm db:seed`      | Refresh demo data.                                                    |
| `pnpm db:studio`    | Open Prisma Studio.                                                   |

### Workspace commands

```bash
pnpm --filter @expense-tracker/backend build
pnpm --filter @expense-tracker/backend test
pnpm --filter @expense-tracker/backend exec jest transactions.service
pnpm --filter @expense-tracker/backend exec jest -t "Decimal amounts"
pnpm --filter @expense-tracker/backend test:e2e

pnpm --filter @expense-tracker/frontend build
pnpm --filter @expense-tracker/frontend test
pnpm --filter @expense-tracker/frontend exec vitest transaction-filters
```

Backend end-to-end tests boot the real application and require PostgreSQL to be running and
migrated. Root `pnpm test` intentionally excludes them.

## Repository conventions

### Dependency direction

- The frontend may import `@expense-tracker/shared`.
- The backend may import `@expense-tracker/shared` and `@expense-tracker/database`.
- The frontend must never import `@expense-tracker/database` or generated Prisma types.
- Shared request/response types must remain framework-neutral.

If the frontend needs a missing API type, add it to `packages/shared`; do not expose the database
package.

### Routes

All frontend API paths come from `API_ROUTES` in
`packages/shared/src/constants/api-routes.ts`. Controllers use the corresponding path segments.
Keep the global `/api` prefix out of `API_ROUTES` because `NEXT_PUBLIC_API_URL` already contains it.

### Validation

- Transport shapes live in `packages/shared`.
- Runtime rules live in NestJS `class-validator` DTOs.
- Use decorated DTO classes for controller `@Body()` and `@Query()` parameters.
- The global validation pipe rejects unknown fields.
- Use `PartialType` from `@nestjs/swagger` for update DTOs so validators and OpenAPI metadata stay
  synchronized.

Do not duplicate backend validation rules in shared interfaces. Frontend Zod schemas are for form
behavior and user feedback, not the authoritative server contract.

### NestJS value imports

Nest dependency injection and request validation depend on emitted runtime metadata. A constructor
dependency or decorated DTO parameter must be a runtime value import, not `import type`.

This is why `typescript/consistent-type-imports` is disabled for the backend. Changing a DI class to
a type-only import can compile successfully and then fail at application startup.

### API documentation

When changing a backend method:

- Add or update its JSDoc.
- Add `@ApiOperation` and response decorators for every expected success and error status.
- Update hand-written response schemas when a plain shared interface changes.
- Verify the generated Swagger output at `/api/docs`.

Swagger can reflect decorated request classes but not erased TypeScript interfaces. Response
schemas for users, categories, transactions, pagination, and errors are therefore maintained by
hand and can drift if not updated deliberately.

### Ownership

Every category and transaction query or mutation must scope by `userId` from the JWT. Never accept
an owner id in the request. Foreign object ids should behave as missing rather than reveal another
user's data.

For deletes, prefer one scoped `deleteMany({ where: { id, userId } })` followed by a `count` check
over an unscoped delete.

### Money

- Database: `Decimal(12, 2)`.
- Create/update input: positive number with at most two decimals.
- Service write: convert with `.toFixed(2)` before passing to Prisma.
- API response: fixed two-decimal string.
- Frontend: parse only at the formatting/display boundary.

Do not perform application arithmetic on response strings or convert persisted amounts through a
binary floating-point round trip.

### Partial updates

Preserve the distinction between omitted and cleared fields:

```ts
...(dto.name !== undefined && { name: dto.name })
```

An omitted value keeps the stored column. Explicit `null` clears only fields whose API and database
contract allow it: user `name`, category `color`/`icon`, and transaction `description` at the wire
boundary.

### Generated and built files

Do not edit:

- `packages/database/src/generated/**`
- `dist/**`
- `.next/**`
- `.turbo/**`

Regenerate or rebuild them through project commands. Prisma-generated files are TypeScript source,
so `skipLibCheck` does not exempt them from compilation.

## Implementation playbooks

### Add or change an API endpoint

1. Add or update the route segment in `packages/shared/src/constants/api-routes.ts`.
2. Add request/response transport shapes in `packages/shared/src/types` and export them from
   `packages/shared/src/index.ts`.
3. Add or update a decorated backend DTO with runtime validation.
4. Add the controller route, JSDoc, Swagger operation, and all response decorators.
5. Implement behavior in the service or, for users-module behavior, behind a command/query handler.
6. Scope persistence by the authenticated `userId` where applicable.
7. Update hand-written OpenAPI response schemas.
8. Add the frontend query/mutation wrapper using `API_ROUTES`.
9. Add tests at the narrowest useful layer, then run workspace and root checks.
10. Update API and architecture documentation when the external contract or boundary changed.

### Add a users command or query

The users module exposes behavior through CQRS:

1. Create the command/query message.
2. Create its handler as a thin adapter over `UsersService` where possible.
3. Add the handler to `USERS_COMMAND_HANDLERS` or `USERS_QUERY_HANDLERS`.
4. Register it through `UsersModule`'s existing handler arrays.
5. Extend `users.cqrs.spec.ts` so an omitted registration fails in tests rather than at runtime.

Command/query messages carrying passwords or raw reset tokens are credentials. Any future logging,
tracing, or custom CQRS publisher must redact them.

### Add or change a database field

Expect the change to cross several layers:

1. Update `packages/database/prisma/schema.prisma`.
2. Create and review the migration SQL with `pnpm db:migrate`.
3. Use data-preserving SQL for renames or backfills; do not accept destructive generated SQL
   blindly.
4. Regenerate Prisma with `pnpm db:generate`.
5. Update shared API shapes if the field crosses the HTTP boundary.
6. Update backend DTOs, service mappings, and hand-written Swagger schemas.
7. Update frontend queries, forms, formatting, and UI.
8. Update seed data and tests where relevant.
9. Run the full verification sequence.

Never put a datasource URL back into `schema.prisma`; Prisma 7 reads it from `prisma.config.ts`.

### Add a frontend query

1. Add the shared route/type first.
2. Add a typed function under `apps/frontend/src/lib/queries`.
3. Define stable, hierarchical query keys.
4. Use `retryApiQuery` so unauthorized requests do not retry.
5. Use `keepPreviousData` for paginated lists.
6. Invalidate every affected snapshot after a mutation.

Category mutations must invalidate both category and transaction queries because each returned
transaction embeds category data.

### Add a transaction filter

1. Add the field to shared `TransactionQuery`.
2. Add validation to `FindTransactionsQueryDto`.
3. Add the Prisma predicate in `TransactionsService.findAll`.
4. Parse and validate the URL value in `transaction-filters.ts`.
5. Include it in the React Query key and serialized request.
6. Reset the page to 1 when the filter changes.
7. Add backend DTO/service tests and frontend parser/query tests.

The URL is untrusted input. Never forward an address-bar value without normalization.

## Testing strategy

### Backend

- Runner: Jest through `ts-jest`.
- Service tests mock persistence and cover business behavior.
- DTO tests exercise `class-validator` constraints.
- CQRS registration tests boot the module and verify handlers are discoverable.
- End-to-end tests use Supertest and a real migrated PostgreSQL database.

When testing CQRS, call `await moduleRef.init()` after compilation. Handlers are discovered during
application bootstrap; `compile()` alone does not populate the buses.

### Frontend

- Runner: Vitest.
- Current coverage focuses on pure functions under `src/lib`.
- The environment is Node, not jsdom.
- There is no Testing Library setup for component tests.

Introducing component tests requires an explicit testing-environment decision rather than an
incidental dependency addition.

### Verification sequence

Run targeted tests first, then the repository checks:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run backend e2e separately when persistence or HTTP composition changed:

```bash
pnpm --filter @expense-tracker/backend test:e2e
```

## Git workflow

The repository uses GitHub Flow:

1. Start from an up-to-date `main`.
2. Create a short-lived branch named `<type>/<short-kebab-case-description>`.
3. Keep one coherent change per branch.
4. Run relevant checks.
5. Open a pull request into `main`.
6. Merge only after review and checks pass, then delete the branch.

Allowed branch types include `feature`, `fix`, `docs`, `refactor`, `test`, and `chore`.

Commit messages follow Conventional Commits:

```text
<type>[optional scope][!]: <imperative lowercase description>
```

Examples:

```text
feat(transactions): add merchant filter
fix(auth): reject expired reset tokens
docs(database): explain category delete behavior
```

Keep the header under roughly 72 characters, omit the trailing period, and explain why in the body
when context is needed.

## Production-style local run

Set production-like environment values before building, especially `DATABASE_URL`, `JWT_SECRET`,
`WEB_ORIGIN`, `WEB_APP_URL`, and `NEXT_PUBLIC_API_URL`.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm db:deploy
```

Run each application in its own terminal:

```bash
pnpm --filter @expense-tracker/backend start:prod
```

```bash
pnpm --filter @expense-tracker/frontend start
```

Do not seed a non-disposable environment unless the demo account and replacement of its demo
transactions are explicitly desired.

## Troubleshooting

### Prisma imports are unresolved

```bash
pnpm install
pnpm db:generate
```

The generated client is absent on a fresh clone by design.

### API cannot connect to PostgreSQL

```bash
docker compose ps
docker compose logs postgres
```

Verify that the service is healthy and `DATABASE_URL` matches the root PostgreSQL variables.

### Browser reports a network or CORS error

Check:

- Backend is listening on `API_PORT`.
- `NEXT_PUBLIC_API_URL` points to that port and includes `/api`.
- `WEB_ORIGIN` exactly matches the browser origin.
- The frontend was restarted after changing `.env.local`.

### Password-reset link points to the wrong host

Set `WEB_APP_URL` in the root `.env` and restart the backend. Reset links are written to the backend
terminal only for known accounts.

### pnpm reports ignored builds

Use pnpm 11 and keep the `allowBuilds` map in `pnpm-workspace.yaml`. A successful-looking install
with ignored builds can leave Prisma engines or the Argon2 native binary unavailable.

### Argon2 installation fails

If no prebuilt binary exists for the platform, `argon2` falls back to `node-gyp`. Install the
platform's native compiler/build toolchain and reinstall dependencies.

### Nest cannot resolve a constructor dependency

Check whether a dependency class was converted to `import type`. Nest needs a runtime value import
to emit and read dependency-injection metadata.

### CQRS reports `CommandHandlerNotFoundException`

Confirm that the handler is included in the appropriate users handler array and that tests calling
the bus initialize the testing module.

## Definition of done

Before considering a change complete:

- Behavior and ownership rules are covered by targeted tests.
- Shared types, backend validation, Swagger schemas, and frontend consumers agree.
- Schema changes include reviewed migration SQL and regenerated Prisma output.
- JSDoc and developer-facing documentation reflect changed behavior.
- No generated output was manually edited or unintentionally committed.
- `format:check`, lint, typecheck, tests, and build pass, or any environment-only gap is recorded.
- The diff contains only files belonging to the requested change.
