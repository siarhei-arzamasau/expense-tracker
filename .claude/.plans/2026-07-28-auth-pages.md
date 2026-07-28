# Registration and login pages on shadcn + password reset

## Requirement

> create plan for implementation of registration and log in page. For UI use shadcn components.
> User should have possibility to register via email and password, also login via email and
> password, and reset password if user forget it. On UI should be functionality to switch between
> registration and login forms.

Breaking it down point by point — note that three of the four points are **already done** on the backend:

| Requirement item                 | Backend                                      | Frontend            |
| -------------------------------- | -------------------------------------------- | ------------------- |
| Registration by email + password | exists: `POST /api/auth/register`, untouched | new form            |
| Login by email + password        | exists: `POST /api/auth/login`, untouched    | rewritten on shadcn |
| Switching between the forms      | —                                            | new: `Tabs`         |
| Resetting a forgotten password   | **absent entirely**: no model, no endpoints  | two new pages       |

The only genuinely new functionality is the password reset. Everything else is UI over an existing API.

## Context

`RegisterDto`, `LoginDto`, `AuthController`, the path through the buses into `UsersService` with argon2 —
all of it works and is covered by tests. The `/login` page (`apps/frontend/src/app/login/page.tsx`, 99 lines)
is hand-written with inline Tailwind classes: `<input>`, `<button>`, `<label>`, no components.

shadcn is **configured but not installed**: `apps/frontend/components.json` exists (style
`new-york`, `baseColor: neutral`, `cssVariables: true`), all the theme tokens are declared in
`src/app/globals.css` (`:root` + `.dark` + `@theme inline`) — the existing login page already
uses `border-input`, `text-destructive`, `bg-primary`. Meanwhile `src/components/ui/`
contains only `.gitkeep`. So **there is no CSS work at all**; all that is needed is `shadcn add`.

Password reset is absent from every layer: `schema.prisma` has no token model, `AuthController` has no
endpoints, the project has no mail dependency of any kind, and `docker-compose.yml` brings up only
Postgres.

## Key decisions (and why)

**The reset link is written to the backend log; no emails are sent.** Confirmed with the user.
`POST /api/auth/forgot-password` logs the finished URL through the Nest `Logger`, and the developer copies
it out of the terminal. Zero new dependencies, zero new services in compose, and the token never leaves
the process. This is exactly the same line of "deliberate learning-template simplifications" already documented
in the README for the token in `localStorage` and the absence of rate limiting. The Mailpit + nodemailer
alternative was considered and rejected as scope creep.

**The token is not returned in the HTTP response.** An unauthenticated endpoint that hands anyone who asks
a password reset token for someone else's email is an account-takeover primitive, qualitatively worse than any
of the simplifications the template has already owned up to.

**`forgot-password` answers `204` whether or not the email exists.** In `AuthService.login`
this decision is already made and commented ("one message for both an unknown email and a wrong
password, so the response does not reveal which emails are registered"). Leaking the email base on a new
endpoint would break a property the system already claims.

**The column stores a SHA-256 of the token, not an argon2 hash.** Next to `passwordHash` this looks like
a mistake, so: the token is 32 random bytes from `crypto.randomBytes`, it is unguessable, and it does not need a slow
KDF. It solves a different problem: argon2 salts each hash separately, so **finding a row by token**
would only be possible by scanning every row with `argon2.verify` on each. SHA-256 is deterministic,
which is what lets the column carry `@unique` and be found with a single indexed query.

**The token is single-use by deletion, not by a `usedAt` column.** After a successful reset all of the user's
tokens are deleted; on a new reset request the old ones are deleted too, so there is always exactly one live
link. A `usedAt` column would be dead weight: the "used" and "does not exist" states produce
**the same** error message, so there is no need — or desire — to distinguish them.

**Password reset gets its own command; `ChangeUserPasswordCommand` cannot be reused.** That one requires
`currentPassword` (see `UsersService.assertPassword`), which is precisely what the user does not have.

**The handler composes and logs the link, not `AuthService`, and the secret never travels over the bus.**
`RequestPasswordResetCommand` returns `void`; `ConfigService` and `Logger` are injected into
`RequestPasswordResetHandler`, and the raw token lives only between `UsersService` and the handler.
The alternative — returning the token from the command and assembling the URL in `AuthService` — was rejected for
two reasons: `AuthService` is described as "owns tokens, and nothing else", and what is meant there is
**JWTs**, not reset strings; and any logging publisher added to the bus later would receive the reset
token in the serialised result. The price is that the handler stops being a purely thin adapter over
`UsersService` and takes on delivery; that is deliberate, because "issue a reset link" is an
application scenario, and the handler layer corresponds to it exactly.

**A successful reset does not issue a JWT.** The response is `204`, and the frontend leads to `/login` with a
success message. Issuing a token off a link from an email would turn that link into a full login.

**Form switching is `Tabs` inside a single `Card` on the existing `/login`.** The route is reused,
so the "Log in" link in `src/app/page.tsx` keeps working. The reset pages still need to be
separate routes — the link from the log has to lead somewhere, and a tab cannot express that.

**The active tab is held in `useState`, not in the URL.** `useSearchParams` in a Next 16 client component
requires a `Suspense` boundary, and paying that for the ability to link to the registration tab is not
worth it. On `/reset-password` `useSearchParams` is unavoidable — `Suspense` will be there (see "Pitfalls").

**shadcn is installed for the authentication pages only.** This is a deliberate reversal of the decision in
`2026-07-28-category-management.md` ("Installing shadcn for this feature would be scope creep"): this time
the requirement itself asks for the components. `/categories` (392 lines) and `/expenses` stay on hand-written
classes. Two idioms live in the codebase for the time being — that is a scope boundary, not an unfinished job;
record it in CLAUDE.md.

## Schema and migration

```prisma
model PasswordResetToken {
  id String @id @default(uuid(7))

  /// SHA-256 от токена, а не argon2: колонку надо ИСКАТЬ по значению, а argon2
  /// солит каждый хэш и потребовал бы перебора всех строк.
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("password_reset_tokens")
}
```

`model User` gains the reverse relation `passwordResetTokens PasswordResetToken[]`.

The migration is an ordinary one, generated in full: `pnpm --filter @expense-tracker/database exec prisma
migrate dev --name add_password_reset_tokens`. The SQL does **not** need hand-editing — this is adding a
table, not renaming a column (the
`20260728035150_rename_password_to_password_hash` case does not repeat).

The lifetime is 60 minutes, as the `PASSWORD_RESET_TTL_MINUTES` constant in `users.service.ts`. It is not moved
into env: in a learning template this value does not vary by environment.

## Type contract — `packages/shared`

`src/types/auth.ts`:

```ts
export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}
```

`src/constants/api-routes.ts` — into the `auth` block:

```ts
forgotPassword: "auth/forgot-password",
resetPassword: "auth/reset-password",
```

Validation rules are **not** duplicated here (CLAUDE.md): they live in the `class-validator` DTOs on the backend
and in the zod schemas on the frontend.

## Message contract

| Message                       | Payload              | Result | Handler exceptions    |
| ----------------------------- | -------------------- | ------ | --------------------- |
| `RequestPasswordResetCommand` | `email`              | `void` | —                     |
| `ResetUserPasswordCommand`    | `token, newPassword` | `void` | `BadRequestException` |

`RequestPasswordResetCommand` returns `void` for every outcome: an unknown email is not an error
but one of the two normal paths. Inside the handler, `UsersService.createPasswordResetToken` returns
`string | null` (modelled on `VerifyUserCredentialsQuery`), and the handler itself decides whether to assemble a URL and
write it to the log or to log a note that the email is unknown. From the outside the difference is invisible.

`ResetUserPasswordCommand` **carries a plaintext password** and joins the CLAUDE.md list:
any logging or tracing publisher is obliged to redact that field.
`RequestPasswordResetCommand` does not join that list — it carries only an email, and the token never
reaches the bus at all (see "Key decisions").

Both handlers are added to `USERS_COMMAND_HANDLERS`
(`src/users/commands/handlers/index.ts`). `tsc` will not notice an omission — the runtime will fail with
`CommandHandlerNotFoundException`; `users.cqrs.spec.ts` is what catches it.

## Endpoints

Both are **without** `JwtAuthGuard` — the user is by definition not authenticated.

| Method | Path                        | Body                  | Response                       |
| ------ | --------------------------- | --------------------- | ------------------------------ |
| `POST` | `/api/auth/forgot-password` | `{ email }`           | `204` always                   |
| `POST` | `/api/auth/reset-password`  | `{ token, password }` | `204`, or `400` on a bad token |

The DTOs are `class-validator`:

- `ForgotPasswordDto`: `@IsEmail()`
- `ResetPasswordDto`: `@IsString() @Length(43, 43)` for `token` — `base64url` of 32 bytes is always
  exactly 43 characters, so the bounds are known precisely and `{"token":"a"}` never reaches the database;
  for `password` —
  `@MinLength(8) @MaxLength(72)` with the same messages as in `RegisterDto`, so that a password which
  can be set at registration can also be set at reset

One message for every reason for refusal: `"Reset link is invalid or has expired"` — expired, already
used and never existed are indistinguishable.

## Files

**`packages/database`**

- `prisma/schema.prisma` — the `PasswordResetToken` model, the reverse relation on `User`
- `prisma/migrations/<timestamp>_add_password_reset_tokens/migration.sql` — generated as is

**`packages/shared`**

- `src/types/auth.ts` — `ForgotPasswordInput`, `ResetPasswordInput`
- `src/constants/api-routes.ts` — `auth.forgotPassword`, `auth.resetPassword`

**`apps/backend`**

- `src/auth/dto/forgot-password.dto.ts`, `src/auth/dto/reset-password.dto.ts` — new
- `src/auth/auth.controller.ts` — two `@Post`s with `@HttpCode(HttpStatus.NO_CONTENT)`; the DTOs
  are imported **as values** (`ValidationPipe` reads them from `emitDecoratorMetadata`)
- `src/auth/auth.service.ts` — two pass-through methods onto the bus, `requestPasswordReset` and
  `resetPassword`. Neither Prisma, nor argon2, nor `ConfigService`, nor `Logger` appear here:
  URL assembly lives in the handler
- `src/users/password-reset-token.repository.ts` — new. Separate from `UsersRepository`, whose
  docstring says "the one place where the `users` table meets Prisma":
  `create`, `findByTokenHash`, `deleteById`, `deleteAllForUser` + `interface PasswordResetTokenRecord`
- `src/users/users.service.ts` — `createPasswordResetToken(email)` and `resetPassword(token, newPassword)`
- `src/users/users.module.ts` — the new repository in `providers` (not in `exports` — the module has none)
- `src/users/commands/request-password-reset.command.ts`, `reset-user-password.command.ts` — new
- `src/users/commands/handlers/request-password-reset.handler.ts` — new; the only handler
  that is not a thin adapter: it injects `ConfigService`, holds a
  `private readonly logger = new Logger(...)` and assembles `${WEB_APP_URL}/reset-password?token=…`
- `src/users/commands/handlers/reset-user-password.handler.ts` — new, a thin adapter
- `src/users/commands/handlers/index.ts` — both into `USERS_COMMAND_HANDLERS` and into the re-export
- `src/users/users.service.spec.ts`, `src/users/users.cqrs.spec.ts`, `src/auth/auth.service.spec.ts` — extended
- `test/app.e2e-spec.ts` — `204` for an unknown email, `400` for a garbage token

**`apps/frontend`**

- `package.json` — the Radix primitives `shadcn add` will pull in: slot (button),
  label (label, form) and tabs (tabs) are needed. **Check the exact list against the command's output,
  not from memory:** shadcn moved from separate `@radix-ui/react-*` packages to a single `radix-ui`
  package, and what actually arrives depends on the CLI version. The rest — `react-hook-form`, `zod`,
  `@hookform/resolvers`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` — is
  **already installed**
- `src/components/ui/{button,input,label,card,tabs,form,alert}.tsx` — generated by the CLI
- `src/components/auth/login-form.tsx`, `src/components/auth/register-form.tsx` — new.
  Extracted from the page deliberately: `categories/page.tsx` grew to 392 lines, no need to repeat that
- `src/lib/validation/auth.ts` — new: the zod schemas for all four forms in one place
- `src/lib/queries/auth.ts` — new: mutation functions modelled on `lib/queries/categories.ts`
- `src/app/login/page.tsx` — rewritten: `Card` + `Tabs`, forms pulled from components
- `src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx` — new
- `src/app/page.tsx` — the "Log in" link label → "Log in / Register"
- `src/app/categories/page.tsx`, `src/app/expenses/page.tsx` — plus `authStorage.clear()` before
  `router.push("/login")` on a 401 (see "Pitfalls"), nothing else

**Root**

- `.env.example` — `WEB_APP_URL=http://localhost:3000`
- `README.md` — the reset flow and its simplifications
- `CLAUDE.md` — the SHA-256 decision and the "shadcn in auth only" boundary

Reused: `apiClient` / `ApiError` (`src/lib/api-client.ts`), `authStorage`,
the `useForm` + `zodResolver` pattern, `PrismaService`, `UsersRepository`.

## Frontend behaviour

**`/login`** (`"use client"`) — a `Card` of `max-w-sm` width, centred, containing `Tabs` with a
`TabsList` of two `TabsTrigger`s: "Log in" and "Register". The active tab is `useState`.

- **`LoginForm`** — email, password, a "Forgot password?" link to `/forgot-password`.
  Success → `authStorage.set(accessToken)` → `router.push("/expenses")`. The
  `demo@example.com` / `password123` defaults are kept: they are useful and mentioned in the README
- **`RegisterForm`** — name (optional), email, password, password confirmation. Success
  behaves exactly like login: `POST /auth/register` already returns an `AuthResponse` with a token
- Errors go into an `Alert` with `variant="destructive"` and `role="alert"`. There is no toast host in
  `providers.tsx`, and `sonner` is not installed just for this

**`/forgot-password`** — a single email field. After a `204` the form is replaced by an `Alert`:
"If an account with that email exists, a reset link has been sent. In this template the link is written
to the backend server log rather than emailed." The wording does not confirm that the account exists —
otherwise the leak-free `204` on the backend would be pointless — and it doubles as the hint about
where the link ends up in template mode.

**`/reset-password`** — reads `?token=` via `useSearchParams`, with "new password" and
"confirmation" fields. Success → `router.push("/login")` with a message. The token only travels in the
POST body; it is present in the query string purely because a link has to be a link.

The zod schemas mirror the DTO bounds (`min(8)`, `max(72)`, `max(100)` for the name) and add what the
backend does not have and does not need: a `.refine` on the password and confirmation matching. As in the
existing `login/page.tsx`, we use `z.string().email()` rather than `z.email()` — valid
in both Zod 3 and Zod 4.

## Order of work

1. **Backend, schema:** the model → `pnpm db:migrate` → `pnpm db:generate`
2. **`packages/shared`:** types and routes (without these the frontend will not compile)
3. **Backend, data layer:** `password-reset-token.repository.ts` → two methods in `UsersService`
4. **Backend, CQRS:** commands → handlers → registration in `USERS_COMMAND_HANDLERS`
5. **Backend, HTTP:** DTOs → `AuthService` → `AuthController`
6. **Backend, tests:** `users.service.spec` → `users.cqrs.spec` → `auth.service.spec` → e2e
7. **Frontend, components** — from `apps/frontend`, not from the root: the CLI looks for `components.json`
   in the working directory, and `pnpm --filter … dlx` does not exist as a command form.

   ```bash
   cd apps/frontend
   pnpm dlx shadcn@latest add button input label card tabs form alert
   cd ../.. && pnpm format
   ```

8. **Frontend, code:** `lib/validation/auth.ts` → `lib/queries/auth.ts` → the forms → the three pages
9. **Documentation:** `.env.example`, README, CLAUDE.md

## Pitfalls

- **`useSearchParams` on `/reset-password` requires `Suspense`.** In Next 16 a client component
  reading search params must sit under a `Suspense` boundary during static rendering, otherwise
  `next build` fails. We wrap the form in `<Suspense fallback={…}>` inside the page; putting
  `export const dynamic = "force-dynamic"` on the whole page is overkill.
- **Read `WEB_APP_URL` through `config.get("WEB_APP_URL", "http://localhost:3000")`, not
  `getOrThrow`.** `getOrThrow` will kill the backend at startup for everyone whose `.env` was copied before this
  change. `getOrThrow` is right for `JWT_SECRET`; for a URL with an obvious default it is not.
- **`.env.example` sits in a directory closed off by access settings** — I did not read or edit it.
  The `WEB_APP_URL=http://localhost:3000` line will have to be added by hand, or access granted.
- **`resetPassword` performs two writes without a transaction.** Updating `passwordHash` and deleting the
  user's tokens are two queries. If the first succeeds and the second fails, the link stays live
  and will work against the **new** password. We wrap it in `this.prisma.$transaction([...])`
  at the repository/service level; silently leaving that window open is not acceptable.
- **`import type` breaks Nest DI.** `ForgotPasswordDto` / `ResetPasswordDto` in `@Body()`,
  `ConfigService` in the handler's constructor, the repository in the service's constructor,
  the command classes in `@CommandHandler(...)` —
  all of these are value imports. The error surfaces not in the types but as "Nest can't resolve dependencies"
  at startup. `typescript/consistent-type-imports` is disabled in the project for exactly this reason.
- **`CqrsModule` registers handlers in `onApplicationBootstrap`.** In `users.cqrs.spec.ts`
  an `await moduleRef.init()` before the first `execute()` is mandatory, otherwise the bus is empty.
- **`shadcn add` writes files that do not follow the oxfmt rules.** `pnpm format:check` is part of the green
  baseline, so `pnpm format` goes immediately after generation, before any edits.
- **`minimumReleaseAge` may block fresh Radix packages.** `pnpm-workspace.yaml` already has a
  `minimumReleaseAgeExclude`, appended by pnpm itself. If the install runs into the release age,
  pnpm will say so and append there too — do not "work around" it by blindly editing versions.
  Radix has no postinstall scripts, so no `allowBuilds` entry is needed.
- **`authStorage.clear()` is not called anywhere in the project.** CLAUDE.md claims the frontend
  "discards the stored token on 401 and on nothing else", but `categories/page.tsx:213-214` and
  `expenses/page.tsx:35-38` only do `router.push("/login")`, leaving a dead token in
  `localStorage`. It is a two-line fix, and it happens here: the login page this redirect leads to
  is the subject of this task, and reconciling the documentation with the code is cheaper
  now than explaining it later.
- **`UsersService` is already ~150 lines**, and two new methods bring it to roughly 190. Tolerable for now;
  if a third token scenario appears, the logic should be extracted into its own service.

## Tests

- **`users.service.spec.ts`** (mock repositories, modelled on the existing cases):
  - `createPasswordResetToken` for an unknown email → `null`, nothing written to the repository
  - for a known one → the raw token is returned, and what reached the repository is **not** it but its SHA-256
    (checked exactly as for the password: the secret goes out, the hash goes into the database)
  - the user's previous tokens are deleted before the new one is created
  - `resetPassword` with an unknown `tokenHash` → `BadRequestException`
  - with an expired `expiresAt` → `BadRequestException`, and the row is deleted
  - success → an argon2 hash of the new password reaches `users.update`, and the user's tokens are deleted
  - a second call with the same token → `BadRequestException` (single use)
- **`users.cqrs.spec.ts`** — both new messages through the bus; the one test that catches
  an unregistered handler
- **`auth.service.spec.ts`** — mock `CommandBus`: `requestPasswordReset` for an unknown email
  completes **without an error** and returns the same result as for a known one (proof that
  email enumeration is absent)
- **`request-password-reset.handler.spec.ts`** — mock `UsersService` + `ConfigService` and a spy on
  `Logger`: for a known email a URL containing `WEB_APP_URL` and the token reaches the log; for an
  unknown one the URL is **not** logged. This is a delivery test, so it lives next to the handler
  rather than in `auth.service.spec.ts`
- **`test/app.e2e-spec.ts`** — `POST /api/auth/forgot-password` with an unregistered email → `204`;
  `POST /api/auth/reset-password` with a garbage token → `400`
- No frontend tests: no infrastructure for them exists in the project, and setting it up here
  is a separate task

## Verification

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm format:check && pnpm build
docker compose up -d
pnpm db:migrate && pnpm db:generate && pnpm db:seed
pnpm --filter @expense-tracker/backend test:e2e
```

Manual acceptance (`pnpm dev`, frontend at http://localhost:3000).

**Run the reset scenario on a throwaway account, not on `demo@example.com`.** `seed.ts`
does an `upsert` with `update: {}`, meaning a repeat `pnpm db:seed` does **not** restore the password
of an existing user. Once the demo password is reset, getting the README-documented
`password123` back would require deleting the user. So step 3 creates `reset-test@example.com`,
and steps 6-10 run against it.

1. `/login` shows two tabs; switching preserves what was typed into each form
2. Login as `demo@example.com` / `password123` → `/expenses` (no regression introduced)
3. Registering `reset-test@example.com` → immediately logged in and on `/expenses`; the same email
   a second time → 409 with a comprehensible message in the `Alert`
4. A 7-character password is **rejected** on the client with no request made; sending the same through Swagger →
   `400` from the DTO (the client and backend bounds agree)
5. A mismatched password confirmation → a field error, no request made
6. `/forgot-password` with `reset-test@example.com` → `204`, and the backend log holds the link
   `http://localhost:3000/reset-password?token=…`
7. The same screen with an email known not to exist → **the same** response and the same on-screen message,
   a note in the log that the email is unknown, and **no URL** (no email enumeration)
8. Following the link → new password → `/login`; logging in with the **old** password gives `401`, with the new one succeeds
9. Following the same link again → "Reset link is invalid or has expired"
10. Requesting a second link makes the first one stop working (there is only one live link)
11. `psql` → `\d password_reset_tokens`: `tokenHash` is unique, and there is no `usedAt` column
12. `DELETE /api/users/me` for `reset-test@example.com` cascade-deletes its tokens
    (and clears away the test account at the same time)
13. Logging in as `demo@example.com` / `password123` still works — the demo account was not touched
14. Dark theme: `<html class="dark">` — the card, the tabs and the `Alert` are legible (the `.dark` tokens exist)
15. `/categories` and `/expenses` look as before — the hand-written classes were not touched

## Out of scope

- **We send no emails.** No nodemailer, no Mailpit, no service in `docker-compose.yml`.
  Link delivery is the backend log. Record it in the README as a template simplification.
- **No rate limiting on `forgot-password`** — consistent with the already-documented
  absence of rate limiting on login. Note it as a known limitation rather than forgetting it.
- **There is no scheduled cleanup of expired tokens.** No cron/scheduler is added to the project;
  tokens from abandoned flows stay in the table until the user is deleted. For a template
  that is noise, not a problem.
- **There is no email verification at registration** — the requirement does not ask for it, and the whole
  mail infrastructure it would need is absent by the decision above.
- **`/categories` and `/expenses` are not rewritten on shadcn.** Two idioms in the codebase
  stay deliberately; the boundary is described in CLAUDE.md.
- **No token revocation, refresh rotation, roles or httpOnly cookies** — CLAUDE.md and the README
  record these as deliberate simplifications. A password reset does **not** invalidate previously issued
  JWTs: no revocation mechanism exists, and an old token will live out its expiry.
  This needs saying plainly in the README — a user expects the opposite from a password change.
- **The application still has no navigation and no logout.** `authStorage.clear()` appears
  only on the 401 handling path; a "Log out" button is a separate task.
