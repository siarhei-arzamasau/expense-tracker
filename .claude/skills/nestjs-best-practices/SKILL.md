---
name: nestjs-best-practices
description: NestJS best practices and architecture patterns for building production-ready applications. This skill should be used when writing, reviewing, or refactoring NestJS code to ensure proper patterns for modules, dependency injection, security, and performance.
license: MIT
model: sonnet
allowed-tools: Bash(pnpm:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Read, Write, Edit, Grep, Glob
argument-hint: [file or module to review, optional]
metadata:
  author: Kadajett
  version: "1.2.0"
---

# NestJS Best Practices

Comprehensive best practices guide for NestJS applications. Contains 40 rules across 10 categories, prioritized by impact to guide automated refactoring and code generation.

## When to Apply

Reference these guidelines when:

- Writing new NestJS modules, controllers, or services
- Implementing authentication and authorization
- Reviewing code for architecture and security issues
- Refactoring existing NestJS codebases
- Optimizing performance or database queries
- Building microservices architectures

## In this repository, read this before applying anything

Scope: `apps/backend` only (NestJS 11, Prisma 7, Postgres 17, Jest via `ts-jest`). The full backend
conventions are in `apps/backend/CLAUDE.md`, and **where a rule below disagrees with that file, that
file wins.** Several of its decisions are deliberate and documented; "fixing" them is a regression, not
an improvement. Raise the conflict instead of silently refactoring.

**Four rules actively contradict documented decisions here:**

- **`security-rate-limiting` — do not apply.** Its "Incorrect" example is `@Post('login')` and
  `@Post('forgot-password')` without throttling, which is exactly this codebase. The root `CLAUDE.md`
  states that auth is a bearer token in `localStorage` with **no refresh rotation and no rate
  limiting** — "deliberate learning-template simplifications documented in the README, not oversights
  to silently 'fix.'" `@nestjs/throttler` is intentionally not a dependency. The accepted mitigation
  for the one unbounded-cost path is the 10,000-page cap in `FindTransactionsQueryDto`, which
  `apps/backend/CLAUDE.md` explains as a cost control *for* an API with no rate limiting.
- **`security-auth-jwt` — partially inapplicable** for the same reason: no refresh-token rotation by
  design. The JWT hygiene it describes (secret from config, expiry, guard coverage) still applies.
- **`arch-use-repository-pattern` — the mixed state is intentional.** `UsersService` sits behind
  `UsersRepository` and `PasswordResetTokenRepository` and is reachable only through the CQRS buses;
  `CategoriesService` and `TransactionsService` inject `PrismaService` **directly and were left that
  way on purpose**. Do not extend the repository layer to those two as a cleanup. Note also the one
  documented exception: `UsersService.resetPassword` writes `users` directly because Prisma's
  interactive `$transaction` needs both writes on the same `tx` client.
- **`error-throw-http-exceptions` — one deliberate exception.** `GetUserByIdQuery` resolves to
  `UserDto | null` rather than throwing, because the caller owns the status code: `GET /auth/me` must
  answer **401** for a token naming a deleted user, since the frontend clears its stored token on 401
  and on nothing else. Making that handler throw `NotFoundException` strands the client holding a
  token that can never work.

**One category does not apply at all:** `micro-*`. This is a single NestJS app in a Turborepo, not a
distributed system — no `@nestjs/microservices`, no message broker, no queue, no orchestrator health
probe. Skip all three rules rather than introducing infrastructure to satisfy them.

**Rules already satisfied, with a gotcha worth knowing:**

- `db-use-migrations` is enforced by CI, harder than the rule asks: after `prisma migrate deploy`, a
  `prisma migrate diff --exit-code` drift check fails the build, so **`schema.prisma` cannot be edited
  without a migration**. Column renames must be hand-written — `migrate dev` renders a rename as
  `DROP` + `ADD` and destroys stored hashes.
- `arch-use-events` is already in place as CQRS, scoped to users. Two boot-order traps:
  `app.module.ts` must register `CqrsModule.forRoot()` (only the dynamic form is `global: true`), and a
  new handler must be added to `USERS_COMMAND_HANDLERS` / `USERS_QUERY_HANDLERS` — omitting it is
  invisible to `tsc` and surfaces as a runtime `CommandHandlerNotFoundException`.
- `devops-use-config-module` is in place, with `envFilePath` anchored to `__dirname` rather than a
  relative string, because cwd differs between `turbo dev` and `start:prod` from the root.
- `security-validate-all-input` is in place, but note where the rules live: `class-validator`
  decorators stay on the DTO and are **never** mirrored into `packages/shared`, which holds request and
  response shapes only. `Category.icon` is validated by grapheme count via `IsSingleEmoji`, never
  `@MaxLength` — `class-validator` counts UTF-16 code units and `"👨‍👩‍👧‍👦".length === 11`.

**Two rules need translating before use:**

- `api-use-dto-serialization` assumes `class-transformer` (`@Exclude`/`@Expose`,
  `ClassSerializerInterceptor`). None of that is used here — every response type is a plain interface
  from `packages/shared` and services map to it by hand (`toDto`). Because Swagger reflects over
  classes and has no class to point at, response schemas are hand-written in `common/swagger/`; they
  can drift, so add the field there when you add it to a DTO. Request bodies are decorated classes and
  do document themselves.
- `api-versioning`: route paths come from `API_ROUTES` in `packages/shared`, so a version prefix is a
  cross-package change, not a controller decorator. Not a unilateral call.

**`test-use-testing-module` has a repo-specific requirement:** a testing module must
`await moduleRef.init()` before any bus call. `CqrsModule` discovers handlers in
`onApplicationBootstrap`, so `compile()` alone leaves the buses empty and every `execute()` throws.

**One hard constraint that touches every DI rule below:** `typescript/consistent-type-imports` is
explicitly disabled for this workspace. Its autofix rewrites `import { PrismaService }` into
`import type`, which erases the `emitDecoratorMetadata` Nest's DI reads at runtime — the backend then
dies at boot with "Nest can't resolve dependencies." Use value imports for anything in a constructor
signature or a `@Body()` parameter.

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Architecture | CRITICAL | `arch-` |
| 2 | Dependency Injection | CRITICAL | `di-` |
| 3 | Error Handling | HIGH | `error-` |
| 4 | Security | HIGH | `security-` |
| 5 | Performance | HIGH | `perf-` |
| 6 | Testing | MEDIUM-HIGH | `test-` |
| 7 | Database & ORM | MEDIUM-HIGH | `db-` |
| 8 | API Design | MEDIUM | `api-` |
| 9 | Microservices | MEDIUM | `micro-` |
| 10 | DevOps & Deployment | LOW-MEDIUM | `devops-` |

## Quick Reference

### 1. Architecture (CRITICAL)

- `arch-avoid-circular-deps` - Avoid circular module dependencies
- `arch-feature-modules` - Organize by feature, not technical layer
- `arch-module-sharing` - Proper module exports/imports, avoid duplicate providers
- `arch-single-responsibility` - Focused services over "god services"
- `arch-use-repository-pattern` - Abstract database logic for testability
- `arch-use-events` - Event-driven architecture for decoupling

### 2. Dependency Injection (CRITICAL)

- `di-avoid-service-locator` - Avoid service locator anti-pattern
- `di-interface-segregation` - Interface Segregation Principle (ISP)
- `di-liskov-substitution` - Liskov Substitution Principle (LSP)
- `di-prefer-constructor-injection` - Constructor over property injection
- `di-scope-awareness` - Understand singleton/request/transient scopes
- `di-use-interfaces-tokens` - Use injection tokens for interfaces

### 3. Error Handling (HIGH)

- `error-use-exception-filters` - Centralized exception handling
- `error-throw-http-exceptions` - Use NestJS HTTP exceptions
- `error-handle-async-errors` - Handle async errors properly

### 4. Security (HIGH)

- `security-auth-jwt` - Secure JWT authentication
- `security-validate-all-input` - Validate with class-validator
- `security-use-guards` - Authentication and authorization guards
- `security-sanitize-output` - Prevent XSS attacks
- `security-rate-limiting` - Implement rate limiting

### 5. Performance (HIGH)

- `perf-async-hooks` - Proper async lifecycle hooks
- `perf-use-caching` - Implement caching strategies
- `perf-optimize-database` - Optimize database queries
- `perf-lazy-loading` - Lazy load modules for faster startup

### 6. Testing (MEDIUM-HIGH)

- `test-use-testing-module` - Use NestJS testing utilities
- `test-e2e-supertest` - E2E testing with Supertest
- `test-mock-external-services` - Mock external dependencies

### 7. Database & ORM (MEDIUM-HIGH)

- `db-use-transactions` - Transaction management
- `db-avoid-n-plus-one` - Avoid N+1 query problems
- `db-use-migrations` - Use migrations for schema changes

### 8. API Design (MEDIUM)

- `api-use-dto-serialization` - DTO and response serialization
- `api-use-interceptors` - Cross-cutting concerns
- `api-versioning` - API versioning strategies
- `api-use-pipes` - Input transformation with pipes

### 9. Microservices (MEDIUM)

- `micro-use-patterns` - Message and event patterns
- `micro-use-health-checks` - Health checks for orchestration
- `micro-use-queues` - Background job processing

### 10. DevOps & Deployment (LOW-MEDIUM)

- `devops-use-config-module` - Environment configuration
- `devops-use-logging` - Structured logging
- `devops-graceful-shutdown` - Zero-downtime deployments

## How to Use

Read individual rule files for detailed explanations and code examples. Paths are repo-relative:

```
.claude/skills/nestjs-best-practices/rules/arch-avoid-circular-deps.md
.claude/skills/nestjs-best-practices/rules/security-validate-all-input.md
.claude/skills/nestjs-best-practices/rules/_sections.md
```

All 40 rules listed above are present in `rules/`, one file per rule, named exactly as the rule id.

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and references

## Full Compiled Document

Upstream publishes a single-document build of these rules as
[AGENTS.md in its repository](https://github.com/Kadajett/agent-nestjs-skills/blob/main/AGENTS.md).
It is intentionally **not** vendored here: it is generated output duplicating `rules/`, and a file by
that name would sit among this repository's own `AGENTS.md` agent-guidance files, which tools discover
by that exact name. Read `rules/<rule-id>.md` instead — the index above is the table of contents.

Note that the upstream link is unpinned and tracks `main`, so it can drift from the vendored copy. The
files in `rules/` are the version this repository was reviewed against.
