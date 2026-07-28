# Replace Expense with Transaction

## Context

`.claude/prompts/transaction-feature.md` asks for a `TransactionModule` — "the central module of the application for managing incomes and spends" — with an `INCOME`/`EXPENSE` type enum, a required `categoryId`, and six endpoints including a monthly aggregation.

The repo's existing `Expense` model is the same concept without a type discriminator. **The user chose full replacement**: `Transaction` supersedes `Expense` rather than sitting beside it. So this is not just "add a module" — the `expenses` table, the `ExpensesModule`, `ExpenseDto`, `CategoryListItemDto.expenseCount`, the frontend `/expenses` page, and the seed all move over, and the existing data migrates with them.

The prompt's Pattern section is backend-only, and the frontend work here is **forced by the replacement, not an invitation to expand**. The `/expenses` page gets ported to `/transactions` at parity — list, category filter, totals, plus a type column and type filter because the model now has one. No summary widget, no create/edit form; the summary endpoint is verified through Swagger.

Two corrections to the prompt's literal text, applied below:

- `npx prisma migrate dev -name add-transactions` does not work here. Prisma 7 keeps the connection URL in `packages/database/prisma.config.ts`, which resolves `.env` relative to `packages/database`; root-level `npx` has the wrong cwd. And it's `--name`, not `-name`. More importantly, plain `migrate dev` is the wrong command for this change entirely — see below.
- Directory and class names are pluralized (`transactions/`, `TransactionsModule`) to match `CategoriesModule`, despite the prompt writing "TransactionModule".

The product name "Expense Tracker" stays — only the domain model is renamed.

## 1. Schema — `packages/database/prisma/schema.prisma`

Delete `model Expense`. Add:

```prisma
enum TransactionType {
  INCOME
  EXPENSE
}

model Transaction {
  id          String          @id @default(uuid(7))
  amount      Decimal         @db.Decimal(12, 2)
  type        TransactionType
  description String?
  date        DateTime
  createdAt   DateTime        @default(now())

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  @@index([userId, date])
  @@index([categoryId])
  @@map("transactions")
}
```

`User.expenses` and `Category.expenses` become `transactions Transaction[]`.

Deliberate choices worth flagging:

- **No `updatedAt`.** The prompt's field list omits it though every other model has one and there is a PATCH endpoint. Followed literally rather than silently widened.
- **`categoryId` required + `onDelete: Restrict`** (confirmed with the user). `SetNull` isn't available on a required column. **Consequence:** `DELETE /api/categories/:id` starts failing for a category with transactions. `CategoriesService.remove` (`apps/backend/src/categories/categories.service.ts:73`) must catch the FK violation and throw `ConflictException("Category still has transactions")` rather than leaking a 500 — and `categories/page.tsx`'s delete dialog copy (line ~361), which currently promises expenses will be kept and unlinked, becomes wrong and needs rewording.

## 2. Migration — hand-written, not generated

`prisma migrate dev` renders a removed model + added model as `DROP TABLE` + `CREATE TABLE`. That destroys every row and then **refuses to run at all**, because the environment is non-interactive and it wants confirmation for the data loss. This is the same situation as `20260728035150_rename_password_to_password_hash`, and takes the same escape hatch: generate with `--create-only`, replace the SQL by hand, apply with `migrate deploy`.

```bash
pnpm --filter @expense-tracker/database exec prisma migrate dev --create-only --name replace_expenses_with_transactions
# edit the generated migration.sql, then
pnpm db:deploy
```

The SQL renames in place so the existing rows survive:

```sql
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

ALTER TABLE "expenses" RENAME TO "transactions";
ALTER TABLE "transactions" RENAME COLUMN "spentAt" TO "date";
ALTER TABLE "transactions" DROP COLUMN "updatedAt";

-- Every pre-existing row was an expense by definition; the default only exists
-- to fill them, then goes away so new rows must state their type.
ALTER TABLE "transactions" ADD COLUMN "type" "TransactionType" NOT NULL DEFAULT 'EXPENSE';
ALTER TABLE "transactions" ALTER COLUMN "type" DROP DEFAULT;

-- categoryId was nullable and is now required. No-op on seeded data (all 7 rows
-- resolve a category), but POST /expenses accepted an omitted categoryId and
-- SetNull could orphan rows, so handle it rather than assume.
INSERT INTO "categories" ("id", "name", "createdAt", "updatedAt", "userId")
SELECT gen_random_uuid(), 'Uncategorized', NOW(), NOW(), t."userId"
FROM (SELECT DISTINCT "userId" FROM "transactions" WHERE "categoryId" IS NULL) t
ON CONFLICT ("userId", "name") DO NOTHING;

UPDATE "transactions" t SET "categoryId" = c."id"
FROM "categories" c
WHERE t."categoryId" IS NULL AND c."userId" = t."userId" AND c."name" = 'Uncategorized';

ALTER TABLE "transactions" ALTER COLUMN "categoryId" SET NOT NULL;

ALTER TABLE "transactions" DROP CONSTRAINT "expenses_categoryId_fkey";
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transactions" RENAME CONSTRAINT "expenses_pkey" TO "transactions_pkey";
ALTER TABLE "transactions" RENAME CONSTRAINT "expenses_userId_fkey" TO "transactions_userId_fkey";
ALTER INDEX "expenses_userId_spentAt_idx" RENAME TO "transactions_userId_date_idx";
ALTER INDEX "expenses_categoryId_idx" RENAME TO "transactions_categoryId_idx";
```

**The constraint and index names are load-bearing.** Prisma's drift detection compares them against what it would generate for the new schema, so a wrong name means a phantom follow-up migration. The verification step below is the only way to know the hand-written SQL is actually equivalent — do not skip it.

`.oxfmtrc.jsonc` exempts `packages/database/prisma/migrations`, so the hand-edited SQL stays as written.

**Alternative considered:** let Prisma generate `DROP` + `CREATE`, accept losing the 7 seeded rows, and treat `pnpm db:seed` as the restore path. Zero drift risk and defensible in a learning template — the rename precedent exists because _password hashes_ were irreplaceable, which seed data isn't. Rejected in favour of the rename because the migration is also the documented pattern for this repo, but it is a reasonable swap if the hand-written SQL proves troublesome.

## 3. Shared types — `packages/shared`

Delete `src/types/expense.ts`. Add `src/types/transaction.ts`. `packages/shared` must not import `@expense-tracker/database`, so the enum needs a source of truth here that the Prisma enum mirrors:

```ts
export const TRANSACTION_TYPES = ["INCOME", "EXPENSE"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export interface TransactionDto {
  id: string;
  amount: string; // Decimal -> string; same float-drift reason as before
  type: TransactionType;
  description: string | null;
  date: string; // ISO
  categoryId: string;
  category: CategoryDto; // non-null now that categoryId is required
  createdAt: string;
}

export interface TransactionSummaryDto {
  month: number;
  year: number;
  income: string;
  expense: string;
  balance: string; // may be negative
}
```

Plus `CreateTransactionInput` / `UpdateTransactionInput` mirroring the old `types/expense.ts` (`amount` as `number` on write). Update `src/index.ts`. In `src/constants/api-routes.ts`, replace the `expenses` block with:

```ts
transactions: {
  root: "transactions",
  summary: "transactions/summary",
  byId: (id: string) => `transactions/${id}`,
},
```

`src/types/category.ts`: `CategoryListItemDto.expenseCount` → `transactionCount`.

## 4. Backend — `apps/backend/src/transactions/`

Delete `apps/backend/src/expenses/` entirely; swap `ExpensesModule` for `TransactionsModule` in `app.module.ts`. The new module is structured after `apps/backend/src/categories/`, with the deleted `ExpensesService` as the reference for money handling and category-ownership checks.

**`dto/create-transaction.dto.ts`** — carried over from `create-expense.dto.ts`:

- `amount`: `@IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() @Max(9_999_999_999)`. Always positive — the sign is carried by `type`, never by the amount.
- `type`: `@IsIn(TRANSACTION_TYPES)` + `@ApiProperty({ enum: TRANSACTION_TYPES })`
- `description`: `@IsOptional() @IsString() @MaxLength(255)`
- `date`: `@IsDateString()`
- `categoryId`: `@IsUUID()` — required, no `@IsOptional()`

**`dto/update-transaction.dto.ts`** — `extends PartialType(CreateTransactionDto)` from `@nestjs/swagger`.

**`dto/find-transactions-query.dto.ts`** — `main.ts` sets `forbidNonWhitelisted: true`, so filters must arrive through a decorated class or unknown params 400. All four optional: `dateFrom`/`dateTo` (`@IsDateString()`), `type` (`@IsIn(TRANSACTION_TYPES)`), `categoryId` (`@IsUUID()`).

**`dto/transaction-summary-query.dto.ts`** — `month` and `year` both required per the prompt: `@IsInt() @Min(1) @Max(12)` and `@IsInt() @Min(1970) @Max(2100)`. `transformOptions.enableImplicitConversion` in `main.ts` handles string→number coercion.

**`transactions.service.ts`** — injects `PrismaService` (value import, never `import type`):

- `findAll(userId, query)` — `where: { userId, ...(type && { type }), ...(categoryId && { categoryId }), ...(dateFrom || dateTo ? { date: { ...(dateFrom && { gte: new Date(dateFrom) }), ...(dateTo && { lte: new Date(dateTo) }) } } : {}) }`, `include: { category: true }`, `orderBy: { date: "desc" }`.
- `summary(userId, month, year)` — **half-open UTC range**: `start = new Date(Date.UTC(year, month - 1, 1))`, `end = new Date(Date.UTC(year, month, 1))`, filtered `date: { gte: start, lt: end }`. An `lte` on end-of-month loses the last day's rows. Aggregate with `groupBy({ by: ["type"], where: {...}, _sum: { amount: true } })`. **`groupBy` omits absent groups** — a month with no income returns one row, not two — so default each side to `"0.00"`. `_sum.amount` is `Decimal | null`. Compute `balance` in integer cents (`Math.round(Number(x) * 100)`, format back with `(cents / 100).toFixed(2)`) — the same technique as `sumAmounts` in `apps/frontend/src/lib/format.ts`.
- `findOne` / `create` / `update` / `remove` — carried over from `ExpensesService`: `findFirst({ where: { id, userId } })`, `deleteMany({ where: { id, userId } })` + `count === 0` → `NotFoundException`, `update` calls `findOne` first for ownership, both write paths call a private `assertCategoryBelongsToUser` (required arg here, not optional) throwing `BadRequestException("Unknown category")`.
- Amounts written as `dto.amount.toFixed(2)`, read back as `record.amount.toFixed(2)` — never `.toString()`, which drops trailing zeros so `82.40` goes out as `"82.4"`.
- Partial update uses the `...(dto.x !== undefined && { x: dto.x })` spread.

**`transactions.controller.ts`** — `@ApiTags("transactions") @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller("transactions")`, `@CurrentUser() user: AuthenticatedUser` throughout.

**Route order is load-bearing: `@Get("summary")` must be declared before `@Get(":id")`.** Nest matches in declaration order; reversed, the literal string `"summary"` goes into `ParseUUIDPipe` and returns 400. This is the likeliest bug in the feature and a service unit spec cannot catch it.

Declaration order: `@Post()`, `@Get()`, `@Get("summary")`, `@Get(":id")`, `@Patch(":id")`, `@Delete(":id")` (`@HttpCode(HttpStatus.NO_CONTENT)`). `:id` params take `ParseUUIDPipe`. DTO classes used as `@Body()`/`@Query()` need **value imports**; response DTO types use `import type` — `categories.controller.ts:15,21-22` shows the exact split.

**`transactions.module.ts`** — controller + service, `exports: [TransactionsService]`.

**`transactions.service.spec.ts`** — port `expenses.service.spec.ts`: local `createPrismaMock()` of `jest.fn()`s, `{ provide: PrismaService, useValue: prisma }`, and the `decimal()` stub whose only method is `toFixed` (so a regression to `.toString()` fails). Add cases for the summary half-open boundaries, the missing-`groupBy`-group default, balance arithmetic, and `findAll` filter composition.

**`categories.service.ts`** — `_count: { select: { expenses: true } }` → `transactions` (line 27), `expenseCount:` → `transactionCount:` (line 94), and `remove` gains the `Restrict` FK catch. **`categories.service.spec.ts` asserts the `include` shape verbatim** (lines ~51-59) and fails until updated.

**`apps/backend/test/app.e2e-spec.ts:28-29`** — `/api/expenses` → `/api/transactions`.

## 5. Frontend — parity port

Rename `apps/frontend/src/app/expenses/` → `transactions/`. Rewrite `page.tsx` against `TransactionDto` / `API_ROUTES.transactions.root`, query key `["transactions"]`.

**The header total becomes a correctness bug if ported mechanically.** Line 66 currently does `sumAmounts(filtered.map(e => e.amount))`; on a mixed INCOME/EXPENSE list that adds income to expenses and shows a meaningless number. Replace with separate income and expense totals plus a net balance, summed in integer cents with the sign taken from `type`.

Required deletions, not cleanup — a required `categoryId` makes this code unreachable:

- the `"uncategorized"` filter chip (lines 115-126), `uncategorizedCount` (line 51), and the `uncategorized` branch of the filter (line 47)
- `CategoryFilter` collapses to `"all" | string`
- the `transaction.category ? ... : "Uncategorized"` ternary (lines 153-168) loses its else branch

Additions: a Type column in the table, and a type filter (All / Income / Expense) alongside the category chips.

Other touch points:

- `apps/frontend/src/app/categories/page.tsx` — invalidation key `["expenses"]` → `["transactions"]` (line 185), `expenseCount` at lines 314 and 361, the `/expenses` link (line 249), and the delete-dialog copy that promises transactions are kept and unlinked (now false under `Restrict`)
- `apps/frontend/src/app/page.tsx:15` — the `/expenses` link. These two are the only links; there is no nav component.
- `apps/frontend/src/lib/format.ts:2` — the `ExpenseDto` reference in the comment

## 6. Docs and seed

`README.md` lines 5, 46 (routes table), 102 (the Decimal paragraph), 136. In `CLAUDE.md`: the `expenseCount` paragraph (rename the fields, **keep the reasoning** — `TransactionDto` embeds a hand-assembled category copy the same way), the Money/Decimal paragraph, the `["expenses"]` invalidation convention, the client-side-filter paragraph, and the path list in the shadcn-split paragraph.

**Leave `.claude/.plans/` alone.** Those are dated records of past decisions, not live docs; rewriting them destroys the reasoning trail.

Seed (`packages/database/prisma/seed.ts`): `EXPENSES` → `TRANSACTIONS`, each row gaining `type`, `spentAt` → `date`, `prisma.expense` → `prisma.transaction`. Add two or three `INCOME` rows (e.g. Salary) against a new income category so the summary endpoint has both sides to aggregate. `categoryIdByName.get(...) ?? null` must become a hard failure now that the column is required.

## Verification

```bash
pnpm db:generate
pnpm --filter @expense-tracker/database exec prisma migrate dev --create-only --name replace_expenses_with_transactions
# hand-write migration.sql, then:
pnpm db:deploy
pnpm db:seed
```

**Drift check — the step that cannot be skipped.** Run `pnpm db:migrate` after applying. It must report no drift and must not want to create a follow-up migration. If it does, a constraint or index name in the hand-written SQL doesn't match what Prisma expects.

```bash
pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm format:check
```

Then `pnpm dev` and exercise the API at `http://localhost:3001/api/docs` (log in as `demo@example.com` / `password123` via `POST /api/auth/login`, click Authorize, paste the token):

1. `GET /api/transactions` — the seeded rows come back with `type`, a non-null `category`, and 2-decimal string amounts. Migrated rows should read `type: "EXPENSE"`.
2. `GET /api/transactions/summary?month=<current>&year=2026` — **the check the unit specs cannot make**: proves the route resolves rather than 400ing through `ParseUUIDPipe`. Verify `income`/`expense`/`balance` are 2-decimal strings, and that a month with only expenses returns `income: "0.00"`.
3. `GET /api/transactions?type=EXPENSE&dateFrom=…&dateTo=…&categoryId=…` — filters compose; `?foo=1` should 400, proving `forbidNonWhitelisted` still applies.
4. `GET /api/transactions/:id` for another user's row → 404.
5. `DELETE /api/categories/:id` for a category with transactions → 409 with a readable message, not a 500.
6. `GET /api/expenses` → 404 (the old module is gone).

Finally, at `http://localhost:3000/transactions`: the list renders, the category and type filters work, income and expense totals are separate and correct, and `/expenses` is a 404.

## Open questions left for implementation time

- **`updatedAt` is dropped** because the prompt's field list omits it, even though every other model has one and there is a PATCH endpoint. Worth reconsidering if edit history matters.
- **The migration preserves 7 seeded rows** that `pnpm db:seed` could simply recreate. If the hand-written SQL fights Prisma's drift detection, the DROP/CREATE alternative in §2 is the escape hatch.
