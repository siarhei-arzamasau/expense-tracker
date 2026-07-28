# Expense Tracker

Monorepo template: **Next.js 16** frontend, **NestJS 11** backend, **PostgreSQL 17** via **Prisma 7**, orchestrated with **Turborepo** and **pnpm workspaces**.

Verified working: `pnpm typecheck`, `lint`, `build`, `test`, and `format:check` all pass, and the seeded `/expenses` slice round-trips through the API.

## Layout

```
expense-tracker/
├── apps/
│   ├── frontend/      @expense-tracker/frontend   Next.js 16, App Router
│   └── backend/       @expense-tracker/backend    NestJS 11, REST + Swagger
└── packages/
    ├── database/      @expense-tracker/database   Prisma schema + generated client
    ├── shared/        @expense-tracker/shared     API response types + route constants
    ├── eslint-config/ @expense-tracker/eslint-config
    └── typescript-config/ @expense-tracker/typescript-config
```

`@expense-tracker/eslint-config` exports **`base` and `nest`** only. Next's rules are composed in `apps/frontend/eslint.config.mjs` directly from `eslint-config-next`, the way `create-next-app` does it — `eslint-config-next` is version-locked to Next itself, so pulling it into a shared package would couple every package's lint to the frontend's framework version.

`packages/database` is a dependency of **`apps/backend` only**. The frontend talks to the backend over HTTP and imports types from `packages/shared` — it never touches Prisma.

## Setup

```bash
nvm use                    # Node 24.18.0
cp .env.example .env

pnpm install               # first validation of every config in the repo
docker compose up -d       # PostgreSQL 17 on :5432

pnpm db:generate           # generate the Prisma client
pnpm db:migrate            # create + apply the initial migration
pnpm db:seed               # demo user, categories, expenses

pnpm dev                   # frontend :3000, backend :3001
```

Seeded login: `demo@example.com` / `password123`.

| URL                            | What                              |
| ------------------------------ | --------------------------------- |
| http://localhost:3000          | Frontend                          |
| http://localhost:3000/expenses | The vertical slice — expense list |
| http://localhost:3001/api      | Backend REST API                  |
| http://localhost:3001/api/docs | Swagger UI                        |

## Scripts

Run from the repo root; Turborepo fans them out in dependency order.

| Command                     | Does                              |
| --------------------------- | --------------------------------- |
| `pnpm dev`                  | All apps in watch mode            |
| `pnpm build`                | Build everything                  |
| `pnpm typecheck`            | Typecheck every package           |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                 |
| `pnpm test`                 | Backend Jest suites               |
| `pnpm db:migrate`           | New migration from schema changes |
| `pnpm db:studio`            | Prisma Studio                     |

## Things that will confuse you if nobody says them

**On a fresh clone the repo does not typecheck until `pnpm install` _and_ `pnpm db:generate` have both run.** Every cross-package import and the entire generated Prisma client are absent before that. A wall of unresolved-import errors at that point is expected, not a broken scaffold.

**TypeScript is pinned to `^5.9.3`, not `latest`.** `latest` is 7.x (the native compiler), but `typescript-eslint` declares `typescript: ">=4.8.4 <6.1.0"` and `ts-jest` declares `>=4.3 <7`. TS 6 and 7 are hard-excluded by our own lint and test toolchain — this is a peer-dependency constraint, not taste. Revisit when those two ship support.

**ESLint is pinned to `^9.39.5`, not `latest` (10.x), and this was learned the hard way.** `typescript-eslint` supports ESLint 10 — but `eslint-config-next`'s transitive plugins (`eslint-plugin-react`, `-import`, `-jsx-a11y`) cap at `^9` and call `scopeManager.addGlobals`, which ESLint 10 removed. Linting the frontend on ESLint 10 dies with `TypeError: scopeManager.addGlobals is not a function`. Checking `typescript-eslint`'s peer range alone is not sufficient; the Next plugins are the binding constraint.

**Prisma 7 changed three things that break v6-shaped configs.**

1. The connection URL is no longer in `schema.prisma` — it lives in `packages/database/prisma.config.ts`.
2. Prisma no longer auto-loads `.env`, which is why that file loads dotenv explicitly. It resolves the **repo root** `.env`, not `packages/database/.env`, because the CLI's cwd is the package directory.
3. **`new PrismaClient()` with no options now throws** — v7 requires a driver adapter. `packages/database/src/client.ts` wires `@prisma/adapter-pg` in one place; `createPrismaClient()` and `createPgAdapter()` are the only supported ways to get a client. `PrismaService` passes the adapter through `super()`.

**`pnpm-workspace.yaml` uses `allowBuilds`, not `onlyBuiltDependencies`.** pnpm 11 renamed the key and changed it from a list to a map; **the pnpm 10 key is silently ignored**. Symptom is `ERR_PNPM_IGNORED_BUILDS` on install, after which the install _reports success_ while leaving Prisma without its engines and argon2 without a native binary. `@scarf/scarf` is deliberately set to `false` — it is analytics telemetry and nothing depends on it.

**If `pnpm build` fails inside `packages/database/src/generated/`, that is not your code.** The Prisma 7 `prisma-client` generator emits **TypeScript source**, and `packages/database` compiles it with our `strict` config. `skipLibCheck` will not help — it only applies to `.d.ts` files, and these are `.ts`. If the generated client trips a strict rule, relax it for that directory only, in `packages/database/tsconfig.json`:

```jsonc
// Add alongside the existing compilerOptions
"exclude": ["node_modules", "dist", "prisma"],
// …and if needed, a second pass that skips strict checks on generated code:
// "compilerOptions": { "strict": false }  ← last resort; prefer the generator's
// `compilerBuild` option or narrowing the rule that actually fails.
```

Do not "fix" the generated files — they are overwritten by the next `pnpm db:generate`.

**Money is `Decimal` in Postgres and `string` in JSON.** `Expense.amount` is `Decimal(12, 2)`; Prisma serializes it to a string over the wire. `ExpenseDto.amount` in `packages/shared` is therefore typed `string`. Parse it at the display boundary — treating it as a `number` gets you `NaN`.

**`docker` CLI not found?** Docker Desktop is installed but its CLI may not be on your `PATH`:

```bash
sudo ln -sf /Applications/Docker.app/Contents/Resources/bin/docker /usr/local/bin/docker
```

Or start Docker Desktop once and let it install the CLI tools.

**`argon2` is a native module.** If pnpm can't fetch a prebuilt binary for your platform it falls back to `node-gyp`, which needs Xcode Command Line Tools (`xcode-select --install`). `@node-rs/argon2` is a drop-in replacement that ships pure prebuilt binaries if this becomes annoying.

## Deliberate simplifications

This is a learning template, not a hardened production app.

- **The JWT is stored client-side as a bearer token, not an httpOnly cookie.** Easier to inspect and debug, but readable by any XSS on the page. Production wants httpOnly + `SameSite` cookies.
- **No refresh-token rotation** — one access token, expiry from `JWT_EXPIRES_IN`.
- **No rate limiting** on the auth endpoints (`@nestjs/throttler` is the usual answer).
- **Auth state lives in `localStorage`** and is read on mount, so the expenses page flashes before redirecting when logged out.
