# Expense Tracker

A full-stack expense tracker for recording income and expenses, organizing transactions by
category, and reviewing monthly totals. The repository is a learning-oriented TypeScript monorepo
with a Next.js web application, a NestJS REST API, and PostgreSQL persistence through Prisma.

## Features

- Register, log in, and recover an account with JWT authentication.
- View monthly income, expenses, balance, and recent activity on the dashboard.
- Create, edit, delete, search, filter, and paginate transactions.
- Create and manage categories with colors and emoji icons.
- Update profile details and password, or delete the current account.
- Explore and test the API through Swagger UI.
- Load a ready-to-use demo account with categories and recent transactions.

## Screenshots

Captured from the seeded demo account (`demo@example.com` / `password123`) after `pnpm db:seed`.

### Dashboard

Monthly balance, income, and expense totals with the most recent activity.

![Dashboard showing monthly balance, income, and expense totals above a recent transactions list](docs/screenshots/dashboard.png)

### Transactions

Full history with description search plus type and category filters.

![Transactions page with a search and filter bar above the full transaction history](docs/screenshots/transactions.png)

### Categories

Categories with a color and emoji icon, and a per-category transaction count.

![Categories page with an add-category form above the existing categories and their transaction counts](docs/screenshots/categories.png)

## Technology stack

| Area           | Technologies                                      |
| -------------- | ------------------------------------------------- |
| Monorepo       | Turborepo 2, pnpm workspaces                      |
| Language       | TypeScript 5.9                                    |
| Frontend       | Next.js 16 App Router, React 19, TanStack Query 5 |
| UI and forms   | Tailwind CSS 4, Radix UI, React Hook Form, Zod    |
| Backend        | NestJS 11, REST, Swagger/OpenAPI, Nest CQRS       |
| Authentication | Passport, JWT bearer tokens, Argon2               |
| Database       | PostgreSQL 17, Prisma 7, `@prisma/adapter-pg`     |
| Testing        | Jest and Supertest (backend), Vitest (frontend)   |
| Quality tools  | Oxlint, Oxfmt, Husky, lint-staged                 |

## Project structure

```text
expense-tracker/
├── apps/
│   ├── frontend/                 # Next.js UI, routes, API client, and React Query hooks
│   │   └── src/app/              # App Router pages and protected application shell
│   └── backend/                  # NestJS REST API
│       └── src/
│           ├── auth/             # Registration, login, JWT, and password recovery
│           ├── users/            # Profile, password, and account management via CQRS
│           ├── transactions/     # Transaction CRUD, filters, paging, and monthly summary
│           ├── categories/       # Category CRUD and usage counts
│           └── prisma/           # NestJS Prisma service
├── packages/
│   ├── database/                 # Prisma schema, migrations, seed, and generated client
│   ├── shared/                   # Shared API types and route constants
│   └── typescript-config/        # Shared TypeScript configurations
├── docs/screenshots/             # Demo-account screenshots used by this README
├── docker-compose.yml            # Local PostgreSQL service
├── turbo.json                    # Monorepo task graph and environment passthrough
└── pnpm-workspace.yaml           # Workspace packages and dependency build allowlist
```

The dependency direction is intentional:

```text
Next.js frontend ──HTTP──> NestJS backend ──Prisma──> PostgreSQL
       │                         │
       └──── packages/shared ────┘
                                 │
                         packages/database
```

Only the backend imports `@expense-tracker/database`. Both applications import transport types and
route constants from `@expense-tracker/shared`.

## Requirements

- Node.js 24 or newer. The repository pins Node `24.18.0` in `.nvmrc`.
- pnpm 11 or newer. The repository pins pnpm `11.15.1` in `package.json`.
- Docker with Docker Compose v2 for the local PostgreSQL instance.
- Free local ports `3000`, `3001`, and `5432`, unless you change the corresponding environment
  variables.

`nvm` is optional, but it is the simplest way to use the pinned Node version:

```bash
nvm install
nvm use
node --version
pnpm --version
```

## Quick start

Run every command from the repository root.

```bash
# 1. Create the backend/database and frontend environment files.
cp .env.example .env
cp apps/frontend/.env.example apps/frontend/.env.local

# 2. Install all workspace dependencies.
pnpm install

# 3. Start PostgreSQL and wait for its health check.
docker compose up -d --wait

# 4. Generate Prisma code, apply development migrations, and load demo data.
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5. Start the frontend and backend in watch mode.
pnpm dev
```

Open the application at [http://localhost:3000](http://localhost:3000), then log in with:

```text
Email:    demo@example.com
Password: password123
```

The seed is safe to run again: it upserts the demo user and categories, then replaces that user's
demo transactions.

## Environment variables

There are two environment files because the backend and frontend load variables from different
locations:

- Root `.env`: read by Docker Compose, Prisma, the seed script, and NestJS. Create it from
  `.env.example`.
- `apps/frontend/.env.local`: read by Next.js. Create it from `apps/frontend/.env.example`.

Both files are gitignored. Never commit real credentials or secrets.

### Root `.env`

| Variable            | Required         | Example/default                                                             | Purpose                                                                                                      |
| ------------------- | ---------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `POSTGRES_USER`     | For Docker setup | `expense`                                                                   | PostgreSQL user created by Docker Compose.                                                                   |
| `POSTGRES_PASSWORD` | For Docker setup | `expense`                                                                   | PostgreSQL password. Use a non-development value outside local use.                                          |
| `POSTGRES_DB`       | For Docker setup | `expense_tracker`                                                           | PostgreSQL database created at first container startup.                                                      |
| `POSTGRES_PORT`     | No               | `5432`                                                                      | Host port mapped to PostgreSQL's container port `5432`.                                                      |
| `DATABASE_URL`      | Yes              | `postgresql://expense:expense@localhost:5432/expense_tracker?schema=public` | Connection string used by Prisma and the backend.                                                            |
| `JWT_SECRET`        | Yes              | `dev-only-change-me`                                                        | Secret used to sign and verify access tokens. Replace it outside local development.                          |
| `JWT_EXPIRES_IN`    | No               | `7d`                                                                        | Access-token lifetime accepted by `jsonwebtoken`, such as `15m`, `1h`, or `7d`.                              |
| `API_PORT`          | No               | `3001`                                                                      | Port used by the NestJS API.                                                                                 |
| `WEB_ORIGIN`        | No               | `http://localhost:3000`                                                     | Exact frontend origin allowed by the backend CORS policy. Do not include a path.                             |
| `WEB_APP_URL`       | No               | `http://localhost:3000`                                                     | Frontend base URL used to build password-reset links. Add it when the frontend URL differs from the default. |

`DATABASE_URL` must match the `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and
`POSTGRES_PORT` values used by Docker Compose. Changing credentials after the PostgreSQL volume has
already been created does not rewrite the existing database user; recreate or update the local
database deliberately.

Generate a suitable JWT secret for non-local environments with:

```bash
openssl rand -base64 32
```

### Frontend `apps/frontend/.env.local`

| Variable              | Required | Example/default             | Purpose                                                                     |
| --------------------- | -------- | --------------------------- | --------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | No       | `http://localhost:3001/api` | Base URL used by the browser API client. It must include the `/api` prefix. |

Variables prefixed with `NEXT_PUBLIC_` are included in the browser bundle. Never place secrets in
them. Set this value before `pnpm build`, and restart the frontend after changing it.

### Changing ports or hosts

Keep these related settings synchronized:

- If PostgreSQL credentials, database name, or host port change, update `DATABASE_URL`.
- If `API_PORT` changes, update `NEXT_PUBLIC_API_URL` in `apps/frontend/.env.local`.
- If the frontend origin changes, update both `WEB_ORIGIN` and `WEB_APP_URL`.

## Running services

| URL                                                                      | Description                          |
| ------------------------------------------------------------------------ | ------------------------------------ |
| [http://localhost:3000](http://localhost:3000)                           | Dashboard                            |
| [http://localhost:3000/transactions](http://localhost:3000/transactions) | Transaction history and filters      |
| [http://localhost:3000/categories](http://localhost:3000/categories)     | Category management                  |
| [http://localhost:3000/profile](http://localhost:3000/profile)           | Profile and account management       |
| [http://localhost:3001/api](http://localhost:3001/api)                   | REST API base URL                    |
| [http://localhost:3001/api/docs](http://localhost:3001/api/docs)         | Swagger UI and OpenAPI documentation |

The frontend and backend run on the host during development; Docker Compose starts PostgreSQL only.
Stop the database without deleting its named volume with `docker compose down`.

## API overview

The API uses the global `/api` prefix. Registration, login, and password-recovery routes are public;
all other application routes require `Authorization: Bearer <accessToken>`.

| Method                   | Endpoint                                      | Authentication | Description                                             |
| ------------------------ | --------------------------------------------- | -------------- | ------------------------------------------------------- |
| `POST`                   | `/api/auth/register`                          | Public         | Create an account and return a JWT.                     |
| `POST`                   | `/api/auth/login`                             | Public         | Exchange credentials for a JWT.                         |
| `GET`                    | `/api/auth/me`                                | Bearer         | Return the current user.                                |
| `POST`                   | `/api/auth/forgot-password`                   | Public         | Request a password-reset link.                          |
| `POST`                   | `/api/auth/reset-password`                    | Public         | Replace a password using a reset token.                 |
| `PATCH`                  | `/api/users/me`                               | Bearer         | Update the current user's email or name.                |
| `PATCH`                  | `/api/users/me/password`                      | Bearer         | Change the current user's password.                     |
| `DELETE`                 | `/api/users/me`                               | Bearer         | Delete the current account after password confirmation. |
| `GET`, `POST`            | `/api/categories`                             | Bearer         | List or create categories.                              |
| `PATCH`, `DELETE`        | `/api/categories/:id`                         | Bearer         | Update or delete an owned category.                     |
| `GET`, `POST`            | `/api/transactions`                           | Bearer         | List or create transactions.                            |
| `GET`                    | `/api/transactions/summary?month=7&year=2026` | Bearer         | Return totals for one calendar month.                   |
| `GET`, `PATCH`, `DELETE` | `/api/transactions/:id`                       | Bearer         | Read, update, or delete an owned transaction.           |

`GET /api/transactions` accepts `page`, `search`, `type`, `categoryId`, `dateFrom`, and `dateTo`
query parameters. Pages contain 10 transactions. Use Swagger UI for request schemas, validation
rules, response shapes, and status codes.

Money is stored as PostgreSQL `Decimal(12, 2)` and returned by the API as a string to avoid
floating-point drift. For example, a transaction amount is returned as `"82.40"`, not `82.4`.

## Password-reset development flow

This project does not send email. After submitting the forgot-password form for a known account,
copy the reset URL from the backend terminal and open it in the browser. The link is single-use and
expires after 60 minutes. The endpoint always returns `204`, including for unknown email addresses,
so it does not disclose whether an account exists.

## Common commands

Run commands from the repository root; Turborepo executes dependent workspace tasks in order.

| Command             | Description                                                   |
| ------------------- | ------------------------------------------------------------- |
| `pnpm dev`          | Run both applications in watch mode.                          |
| `pnpm build`        | Generate Prisma code and build every package and application. |
| `pnpm typecheck`    | Type-check all workspaces.                                    |
| `pnpm lint`         | Lint all workspaces with Oxlint.                              |
| `pnpm lint:fix`     | Apply safe Oxlint fixes.                                      |
| `pnpm format`       | Format the repository with Oxfmt.                             |
| `pnpm format:check` | Check formatting without changing files.                      |
| `pnpm test`         | Run backend Jest tests and frontend Vitest tests.             |
| `pnpm db:generate`  | Generate the gitignored Prisma client.                        |
| `pnpm db:migrate`   | Create and apply development migrations.                      |
| `pnpm db:deploy`    | Apply existing migrations without creating new ones.          |
| `pnpm db:seed`      | Load or refresh the demo account data.                        |
| `pnpm db:studio`    | Open Prisma Studio.                                           |

Useful workspace-specific checks:

```bash
pnpm --filter @expense-tracker/backend test
pnpm --filter @expense-tracker/backend test:e2e  # requires a running, migrated database
pnpm --filter @expense-tracker/frontend test
pnpm --filter @expense-tracker/frontend build
```

The root `pnpm test` command intentionally excludes backend end-to-end tests because they require a
live PostgreSQL database.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request targeting `main` and on every push to `main`.
It has two jobs, so a failure points at one half of the suite rather than the whole run:

| Job                         | Commands                                           |
| --------------------------- | -------------------------------------------------- |
| **Lint and static quality** | `pnpm format:check`, `pnpm lint`, `pnpm typecheck` |
| **Tests and build**         | `pnpm test`, `pnpm build`                          |

Both jobs use the pinned Node version from `.nvmrc` and the pinned pnpm version from
`package.json`, install with `pnpm install --frozen-lockfile`, and need no repository secrets. A
placeholder `DATABASE_URL` is set at the workflow level because `prisma generate` requires the
variable to resolve; no database is contacted, and no PostgreSQL service runs. Backend end-to-end
tests are therefore excluded from CI for the same reason they are excluded from `pnpm test`.

Note that `oxfmt` formats YAML, so the lint job checks the workflow file itself. Run
`pnpm format:check` before pushing changes to `.github/workflows`.

## Production-style local run

Build all workspaces, apply existing migrations, and run the applications in separate terminals:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm db:deploy

# Terminal 1
pnpm --filter @expense-tracker/backend start:prod

# Terminal 2
pnpm --filter @expense-tracker/frontend start
```

Set production environment values before building. In particular, replace `JWT_SECRET`, point
`DATABASE_URL` at the target PostgreSQL instance, and set the public API and web origins correctly.
Seeding is optional and should normally be omitted outside a disposable development environment.

## Troubleshooting

- **Imports from Prisma are unresolved on a fresh clone:** run `pnpm install` and
  `pnpm db:generate`. The generated client is intentionally gitignored.
- **The API cannot connect to PostgreSQL:** run `docker compose ps`, wait until the database is
  healthy, and verify that `DATABASE_URL` matches the Docker settings.
- **The browser reports CORS or network errors:** verify `WEB_ORIGIN`, `API_PORT`, and
  `NEXT_PUBLIC_API_URL`, including the `/api` suffix on the public API URL.
- **A reset link points to the wrong host:** set `WEB_APP_URL` in the root `.env` and restart the
  backend.
- **pnpm reports ignored dependency builds:** use pnpm 11 and keep the `allowBuilds` entries in
  `pnpm-workspace.yaml`; Prisma and Argon2 require their install scripts.
- **Argon2 cannot install a prebuilt binary:** install the platform's native build toolchain so
  `node-gyp` can compile it.

## Security scope

This repository is a learning template, not a production-hardened service. Access tokens are stored
in `localStorage`; there is no refresh-token rotation, authentication rate limiting, email delivery,
or token revocation after a password reset. Production deployments should address those boundaries
before handling real user or financial data.

## License

Released under the [MIT License](LICENSE).
