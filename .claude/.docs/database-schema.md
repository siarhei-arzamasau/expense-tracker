# Database Schema

This document describes the PostgreSQL schema, the purpose of every field, relation behavior,
indexes, migration history, and the Prisma 7 integration used by Expense Tracker.

The canonical schema is `packages/database/prisma/schema.prisma`. Checked-in migrations are under
`packages/database/prisma/migrations`.

## Entity relationships

```text
User 1 ──────── * Category
  │                  │
  │                  │ 1
  │                  │
  │                  *
  ├────────── * Transaction
  │
  └────────── * PasswordResetToken
```

More explicitly:

- A user owns zero or more categories.
- A user owns zero or more transactions.
- A category belongs to exactly one user.
- A transaction belongs to exactly one user and exactly one category.
- A user owns zero or more password-reset-token records.

The service layer additionally guarantees that a transaction's user and category owner are the
same person.

## General conventions

### Identifiers

All primary keys are Prisma `String` values generated with `uuid(7)`. PostgreSQL stores them as
`TEXT`, not as its native `uuid` type. UUID version 7 provides time-ordered identifiers while still
being suitable for distributed generation.

### Timestamps

Prisma `DateTime` fields map to PostgreSQL `TIMESTAMP(3)`. API responses convert them to ISO-8601
strings.

- `createdAt` records row creation and defaults to `now()`.
- `updatedAt` exists only on mutable user and category records and is maintained by Prisma.
- Transaction and reset-token records do not have an `updatedAt` field.

### Money

Transaction amounts use PostgreSQL `DECIMAL(12, 2)`, never a floating-point type. Prisma returns a
Decimal object; the backend serializes it as a fixed two-decimal string such as `"82.40"`.

### Table names

Prisma models use singular PascalCase names, while `@@map` keeps PostgreSQL table names plural and
snake_case where needed:

| Prisma model         | PostgreSQL table        |
| -------------------- | ----------------------- |
| `User`               | `users`                 |
| `Category`           | `categories`            |
| `Transaction`        | `transactions`          |
| `PasswordResetToken` | `password_reset_tokens` |

## `User` / `users`

Represents an account that can authenticate and own all other domain data.

| Field          | Prisma type | Null/default/index        | Purpose                                                                                              |
| -------------- | ----------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `id`           | `String`    | Primary key, `uuid(7)`    | Stable account identifier and JWT subject.                                                           |
| `email`        | `String`    | Unique, required          | Login identifier and account-contact address. Exact uniqueness is enforced by PostgreSQL.            |
| `passwordHash` | `String`    | Required                  | Argon2 password hash. Plaintext passwords are never stored and this field never appears in API DTOs. |
| `name`         | `String?`   | Nullable                  | Optional display name. `null` means the account has no display name.                                 |
| `createdAt`    | `DateTime`  | Required, default `now()` | Account creation time. Exposed in the public user DTO.                                               |
| `updatedAt`    | `DateTime`  | Required, `@updatedAt`    | Last Prisma-managed update time. Internal; not exposed by the API.                                   |

Relations:

| Relation              | Cardinality                   | Delete behavior                                    |
| --------------------- | ----------------------------- | -------------------------------------------------- |
| `categories`          | One user to many categories   | Categories are deleted when the user is deleted.   |
| `transactions`        | One user to many transactions | Transactions are deleted when the user is deleted. |
| `passwordResetTokens` | One user to many reset tokens | Reset tokens are deleted when the user is deleted. |

Index:

- `users_email_key` is a unique index supporting registration uniqueness checks and login lookup.

## `Category` / `categories`

Represents a user-owned label used to classify transactions.

| Field       | Prisma type | Null/default/index                       | Purpose                                                                                              |
| ----------- | ----------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `id`        | `String`    | Primary key, `uuid(7)`                   | Stable category identifier used by transaction requests.                                             |
| `name`      | `String`    | Required; composite unique with `userId` | User-visible category name. Different users may use the same name.                                   |
| `color`     | `String?`   | Nullable                                 | Optional CSS hexadecimal color used by the UI. Format is validated by the backend, not the database. |
| `icon`      | `String?`   | Nullable                                 | Optional single emoji grapheme. The backend's custom validator enforces the one-emoji rule.          |
| `createdAt` | `DateTime`  | Required, default `now()`                | Category creation time; included in API responses and embedded category snapshots.                   |
| `updatedAt` | `DateTime`  | Required, `@updatedAt`                   | Last Prisma-managed update time. Internal.                                                           |
| `userId`    | `String`    | Required, foreign key                    | Owner of the category. Always derived from the authenticated user.                                   |

Relations and constraints:

- `userId` references `users.id` with `ON DELETE CASCADE`.
- `@@unique([userId, name])` makes names unique within one user's categories.
- `transactions` is the collection of transactions assigned to the category.

Category deletion is restricted indirectly by the required transaction relation. If transactions
still reference a category, PostgreSQL rejects deletion and the backend translates Prisma error
`P2003` into HTTP `409 Conflict`.

## `TransactionType`

PostgreSQL enum with two values:

| Value     | Meaning                            |
| --------- | ---------------------------------- |
| `INCOME`  | Money entering the user's balance. |
| `EXPENSE` | Money leaving the user's balance.  |

The amount is always positive. Direction belongs to this enum rather than to the sign of `amount`.

## `Transaction` / `transactions`

Represents one dated income or expense entry.

| Field         | Prisma type       | Null/default/index                         | Purpose                                                                                                |
| ------------- | ----------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `id`          | `String`          | Primary key, `uuid(7)`                     | Stable transaction identifier.                                                                         |
| `amount`      | `Decimal`         | Required, PostgreSQL `Decimal(12, 2)`      | Exact positive monetary amount. The backend converts input to a two-decimal string before persistence. |
| `type`        | `TransactionType` | Required                                   | Determines whether the amount contributes to income or expense totals.                                 |
| `description` | `String?`         | Nullable                                   | Optional free-text explanation; maximum length is enforced by the API.                                 |
| `date`        | `DateTime`        | Required; indexed with `userId`            | When the financial event occurred. Used for sorting, filtering, and monthly summaries.                 |
| `createdAt`   | `DateTime`        | Required, default `now()`                  | When the record itself was created.                                                                    |
| `userId`      | `String`          | Required, foreign key; indexed with `date` | Owner of the transaction. Every query scopes by this value.                                            |
| `categoryId`  | `String`          | Required, foreign key; indexed             | Classification category. The service verifies it belongs to the same user.                             |

Relations:

- `userId` references `users.id` with `ON DELETE CASCADE`.
- `categoryId` references `categories.id` with `ON DELETE RESTRICT`.

The restrictive category relation is intentional. Deleting a category must never silently delete
transactions or leave them orphaned; the user must reassign or delete those transactions first.

Indexes:

| Index                                              | Purpose                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `transactions_userId_date_idx` on `(userId, date)` | Supports owner-scoped chronological lists, date filters, and monthly ranges. |
| `transactions_categoryId_idx` on `(categoryId)`    | Supports category filtering, relation lookups, and foreign-key checks.       |

List results add `id DESC` as a secondary sort in application queries so equal dates have stable
pagination, even though `id` is not part of the composite date index.

## `PasswordResetToken` / `password_reset_tokens`

Represents a short-lived, single-use password reset credential.

| Field       | Prisma type | Null/default/index             | Purpose                                                                                          |
| ----------- | ----------- | ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `id`        | `String`    | Primary key, `uuid(7)`         | Internal reset-token row identifier.                                                             |
| `tokenHash` | `String`    | Unique, required               | Lowercase hexadecimal SHA-256 digest of the raw reset token. The raw credential is never stored. |
| `expiresAt` | `DateTime`  | Required                       | Absolute expiration time. The application rejects and deletes expired tokens.                    |
| `createdAt` | `DateTime`  | Required, default `now()`      | Token issue time.                                                                                |
| `userId`    | `String`    | Required, foreign key, indexed | Account whose password may be reset.                                                             |

Relations and indexes:

- `userId` references `users.id` with `ON DELETE CASCADE`.
- `password_reset_tokens_tokenHash_key` supports one indexed lookup from the submitted token digest.
- `password_reset_tokens_userId_idx` supports invalidating all tokens for one user.

SHA-256 is used here instead of Argon2 for a specific reason: reset tokens contain 32 random bytes
and are already unguessable, while the application must locate a row by a deterministic digest.
Argon2 salts each hash independently and would require scanning and verifying every token row.

Only one generation of reset links is intended to remain usable. Creating a token deletes all
previous tokens for the user; a successful reset deletes all remaining tokens in the same database
transaction as the password update.

## Referential actions

| Parent deletion              | Result                                                                     |
| ---------------------------- | -------------------------------------------------------------------------- |
| Delete a user                | Cascades to all owned categories, transactions, and password-reset tokens. |
| Delete an unused category    | Category is deleted.                                                       |
| Delete a referenced category | Rejected by PostgreSQL; API returns `409 Conflict`.                        |
| Delete a transaction         | Category and user remain unchanged.                                        |
| Delete a reset token         | User remains unchanged.                                                    |

Account deletion is therefore the only operation that intentionally removes the entire owned data
graph.

## Database-enforced vs application-enforced rules

### Enforced by PostgreSQL/Prisma schema

- Primary keys and required columns.
- Unique user emails.
- Unique category names per user.
- Decimal precision and scale.
- Transaction type enum values.
- Foreign-key integrity and delete behavior.
- Required transaction categories.

### Enforced by backend validation or services

- Email syntax.
- Password length and hashing.
- Category name length, hexadecimal colors, and emoji grapheme count.
- Positive transaction amount and maximum two decimal places.
- Description length and ISO-8601 date syntax.
- A transaction category belonging to the same user.
- User ownership on every read and mutation.
- Reset-token expiration and single-use behavior.

Schema migrations and API validation must be considered together when changing a rule.

## Prisma 7 integration

### Configuration

Prisma 7 does not read the datasource URL from `schema.prisma`. The connection URL lives in
`packages/database/prisma.config.ts`, which:

1. Loads the repository root `.env` explicitly.
2. Declares the schema and migration paths.
3. Registers `tsx prisma/seed.ts` as the seed command.
4. Reads `DATABASE_URL` into the datasource configuration.

The explicit root path matters because Prisma commands run with `packages/database` as their
working directory.

### Generated client

The `prisma-client` generator writes TypeScript source to
`packages/database/src/generated`. This directory is gitignored and must be recreated with:

```bash
pnpm db:generate
```

Generator settings are explicit:

- `moduleFormat = "cjs"`
- `generatedFileExtension = "ts"`
- `importFileExtension = ""`

The NestJS backend is the only runtime consumer and compiles to CommonJS.

### Driver adapter

Prisma 7 requires a driver adapter. `packages/database/src/client.ts` is the single construction
point for `PrismaPg` and `PrismaClient`. The Nest `PrismaService` passes the adapter to `super()`,
opens the connection during module initialization, and disconnects during shutdown.

Instantiating `new PrismaClient()` without options is unsupported in this project.

## Migration history

| Migration                                           | Purpose                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260728000356_init`                               | Created users, categories, and the original expenses table with initial indexes and relations.                                                    |
| `20260728035150_rename_password_to_password_hash`   | Renamed `users.password` to `passwordHash` without destroying existing hashes.                                                                    |
| `20260728055130_add_password_reset_tokens`          | Added reset-token persistence, uniqueness, user index, and cascade relation.                                                                      |
| `20260728120000_add_category_icon`                  | Added nullable category emoji metadata.                                                                                                           |
| `20260728140000_replace_expenses_with_transactions` | Renamed expenses to transactions, added income/expense type, made category required, adjusted relation behavior, and renamed indexes/constraints. |

The password column migration is hand-written. Prisma's generated change would have dropped the
old column and added a new one, destroying every stored hash. Column renames and other
data-preserving transformations must be reviewed at the SQL level before application.

The expenses-to-transactions migration also contains explicit data repair: any legacy row without a
category is assigned to a per-user `Uncategorized` category before `categoryId` becomes required.

## Seed data

`packages/database/prisma/seed.ts` creates a local demonstration dataset:

```text
demo@example.com / password123
```

It upserts the demo user and five categories, then replaces that user's transaction rows with a
fresh set whose dates are relative to the day the seed runs. Re-running the seed does not duplicate
demo transactions, but an existing demo user's password is not overwritten by the upsert.

## Database commands

Run from the repository root:

| Command            | Purpose                                                          |
| ------------------ | ---------------------------------------------------------------- |
| `pnpm db:generate` | Regenerate the Prisma client after schema or dependency changes. |
| `pnpm db:migrate`  | Create and apply a development migration.                        |
| `pnpm db:deploy`   | Apply checked-in migrations without creating new ones.           |
| `pnpm db:seed`     | Load or refresh the demonstration data.                          |
| `pnpm db:studio`   | Open Prisma Studio against `DATABASE_URL`.                       |

Never edit `packages/database/src/generated` manually. Generation overwrites it, and failures in
that directory must be addressed through schema, generator, or TypeScript configuration changes.
