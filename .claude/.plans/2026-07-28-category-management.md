# Expense categories: entity, service, controller

## Status

**Everything the assignment requires is already implemented and committed in `698eb9b`.** This document
was brought in line with the assignment's wording after the fact: the sections were reordered to follow
the four required points, and the frontend part was moved out into "Beyond the assignment". This changes
no code — there are no outstanding requirement items.

## Requirement

> Authentication is already implemented. The task now is to build expense categories: add a category
> entity with an identifier, a name, an icon, a color and the identifier of the user the category
> belongs to. Then implement a categories service with methods for creating, finding, updating and
> deleting all of the user's categories, plus a controller exposing those endpoints, protected by the
> current guards and validated with a class validator.

| Assignment item         | Where it lives                                     | What had to be added                    |
| ----------------------- | -------------------------------------------------- | --------------------------------------- |
| Category entity         | `model Category` in `schema.prisma`                | the `icon` column; the rest existed     |
| Service: create         | `CategoriesService.create`                         | the `icon` parameter                    |
| Service: find           | `CategoriesService.findAll`                        | `_count` and `toListItemDto`            |
| Service: update         | `CategoriesService.update`                         | **the whole method — it did not exist** |
| Service: delete         | `CategoriesService.remove`                         | nothing                                 |
| Controller under guards | `CategoriesController`, `@UseGuards(JwtAuthGuard)` | `@Patch(":id")`                         |
| Class-based validation  | `Create`/`UpdateCategoryDto`                       | `UpdateCategoryDto`, `IsSingleEmoji`    |

Two places where the wording is easy to misread:

- **"deleting all of the user's categories"** — this is about the whole CRUD surface being scoped to the
  current user's categories, not about bulk deletion in a single request. There is no
  `DELETE /api/categories` endpoint and none is planned.
- **"an icon, a color"** — two separate nullable fields (`icon` and `color`), not "the icon's color".
  `color` already existed on the model.

## Context

The `Category` model exists, but it is nearly unusable. `CategoriesService` only has
`findAll` / `create` / `remove` — **there is no update endpoint at all**, so the already-present
`color` column can be set at creation time and never changed again. The icon does not exist as a column.

What the assignment has us do:

1. **An `icon` column** on `Category` — a single emoji.
2. **`PATCH /api/categories/:id`** — editing the name, color and icon.
3. **The `IsSingleEmoji` class validator** — a rule for `icon` that cannot be expressed with the
   stock `class-validator` decorators.

Beyond the assignment, in its own section below: the `/categories` page and the expense filter by
category — without them the backend CRUD is not visible from the application at all.

## Key decisions (and why)

**The uniqueness check in `update` must exclude the row being edited.**
`@@unique([userId, name])` means a rename can collide with another category's name.
`create` already throws `ConflictException` — `update` repeats the check, but with
`if (existing && existing.id !== id)`. Without that, saving a category **without** renaming it
answers 409.

**Emoji validation goes through `Intl.Segmenter`, not `@MaxLength`.**
`class-validator` counts UTF-16 code units, and `"👨‍👩‍👧‍👦".length === 11`. A length cap
rejects most real emoji. We count grapheme clusters instead (Node 24 has `Intl.Segmenter`)
and require exactly one. This is the assignment's "class validator" in the literal sense:
a `ValidatorConstraintInterface`, not a composition of stock decorators.

**`expenseCount` lives on a separate `CategoryListItemDto`, not on `CategoryDto`.**
_Strictly speaking the counter is outside the assignment_ — it is needed by the delete confirmation and
by the filter chip labels. Given that it exists anyway, where it lives matters: `ExpenseDto` embeds a copy
of its category, and `ExpensesService.toDto` assembles that nested object by hand (`expenses.service.ts:122-129`).
A required counter field on `CategoryDto` would force a wasted aggregate for every single expense.
`GET /categories` returns the extended type; the nested copy stays flat.

## Schema and migration

`packages/database/prisma/schema.prisma`, inside `model Category`:

```prisma
  /// One emoji. The backend's IsSingleEmoji validator enforces the rule.
  icon String?
```

The model already has the assignment's other fields: `id` (`uuid(7)`), `name`, `color`, `userId`
with `@relation(onDelete: Cascade)` and `@@unique([userId, name])`.

The field is additive and nullable, so `prisma migrate dev --name add_category_icon` will generate a
clean `ALTER TABLE ... ADD COLUMN` and run without interactive confirmation. This is **not**
the hand-written-SQL case CLAUDE.md warns about — that one is about column renames.
Then `pnpm db:generate`.

`prisma/seed.ts` — icons for the seeded categories, and the upsert's `update` is widened so that
re-seeding backfills already-existing rows:

```ts
const CATEGORIES = [
  { name: "Groceries", color: "#22c55e", icon: "🛒" },
  { name: "Transport", color: "#3b82f6", icon: "🚌" },
  { name: "Dining",    color: "#f97316", icon: "🍽️" },
  { name: "Utilities", color: "#a855f7", icon: "💡" },
];
// ...
update: { color: category.color, icon: category.icon },
```

## Type contract — `packages/shared/src/types/category.ts`

```ts
export interface CategoryDto {
  id: string;
  name: string;
  color: string | null;
  icon: string | null; // new
  createdAt: string;
}

/** For GET /categories only. The counter is needed by the delete confirmation and by the
 *  filter chip labels; the copy embedded in ExpenseDto deliberately does NOT carry it. */
export interface CategoryListItemDto extends CategoryDto {
  expenseCount: number;
}

export interface CreateCategoryInput {
  name: string;
  color?: string;
  icon?: string;
}

/** NOT `Partial<CreateCategoryInput>`: `null` has to be expressible, because the
 *  "No color" / "Remove icon" buttons clear the column. `undefined` means "leave alone",
 *  `null` means "clear". */
export interface UpdateCategoryInput {
  name?: string;
  color?: string | null;
  icon?: string | null;
}
```

`API_ROUTES.categories.byId` already exists — the route constants do not change.

## Endpoints

| Method   | Path                  | Body                       | Response                        |
| -------- | --------------------- | -------------------------- | ------------------------------- |
| `GET`    | `/api/categories`     | —                          | `200` + `CategoryListItemDto[]` |
| `POST`   | `/api/categories`     | `{ name, color?, icon? }`  | `201` + `CategoryDto`           |
| `PATCH`  | `/api/categories/:id` | `{ name?, color?, icon? }` | `200` + `CategoryDto`           |
| `DELETE` | `/api/categories/:id` | —                          | `204`                           |

`GET` and `POST` already exist; `PATCH` is new. Everything sits under `JwtAuthGuard` (the assignment's
"current guards" means exactly that one — no separate ownership guard is introduced), and `userId` comes
only from `@CurrentUser()`, never from the body or the query string. Scoping the query to the owner
is itself the protection against other users' rows.

## Files

**`packages/database`**

- `prisma/schema.prisma` — `icon String?` in `Category`
- `prisma/migrations/<timestamp>_add_category_icon/migration.sql` — generated, no editing needed
- `prisma/seed.ts` — icons in `CATEGORIES`, `icon` in the upsert's `create`/`update`

**`packages/shared`**

- `src/types/category.ts` — per the contract above

**`apps/backend/src/categories/`**

- `validators/is-single-emoji.ts` — new:

  ```ts
  @ValidatorConstraint({ name: "isSingleEmoji", async: false })
  class IsSingleEmojiConstraint implements ValidatorConstraintInterface {
    validate(value: unknown): boolean {
      if (typeof value !== "string" || value.length === 0 || value.length > 32) return false;
      const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
      const graphemes = [...segmenter.segment(value)];
      return (
        graphemes.length === 1 && /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(value)
      );
    }
    defaultMessage(): string {
      return "icon must be a single emoji";
    }
  }
  export function IsSingleEmoji(options?: ValidationOptions) {
    /* registerDecorator */
  }
  ```

  `length > 32` is a cheap guard ahead of segmentation. `\p{Regional_Indicator}` is in the alternation
  because flags (🇺🇸) are one grapheme cluster but **not** `Extended_Pictographic`, and would be
  rejected without it. Keycap sequences (1️⃣) stay rejected — that is a digit plus a combining
  frame, which is what an icon field wants.

- `dto/create-category.dto.ts` — an `icon?: string` field with `@IsOptional() @IsSingleEmoji()`
  and `@ApiPropertyOptional({ example: "🛒" })`
- `dto/update-category.dto.ts` — new, exactly modelled on `expenses/dto/update-expense.dto.ts`:
  `export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}`
  (`PartialType` from `@nestjs/swagger`, not from `@nestjs/mapped-types`). The `color`/`icon` types
  are widened to `string | null` so that clearing a column is typed rather than working
  by accident off `apiClient.patch`'s `body: unknown`.
- `categories.service.ts`:
  - `CategoryRecord` (line 7) gains `icon: string | null`, and `toDto` returns it
  - `findAll` — `include: { _count: { select: { expenses: true } } }` plus a separate
    `toListItemDto` mapper; `toDto` stays flat
  - a new `update(userId, id, dto): Promise<CategoryDto>` — first
    `findFirst({ where: { id, userId } })` and a 404, then the uniqueness check excluding
    the row itself, then assembling `data` with the `...(dto.x !== undefined && { x: dto.x })` idiom
    from `ExpensesService.update`. That spread is exactly what distinguishes "field omitted — leave alone"
    from "`null` arrived — clear it"; `@IsOptional()` already lets `null` through the validator.
  - `remove` unchanged
- `categories.controller.ts` — `@Patch(":id")` with `ParseUUIDPipe`, modelled on
  `ExpensesController`; the return type of `findAll` → `Promise<CategoryListItemDto[]>`
- `categories.service.spec.ts` — new (the service currently has no spec at all)

**Ricochet from `CategoryDto`** — `apps/backend/src/expenses/expenses.service.ts` duplicates
`CategoryRecord` (line 8) and assembles the nested category by hand in `toDto` (lines 122-129).
Both need `icon`. It cannot be skipped — `tsc` will not build.

**What is reused rather than written from scratch:** the `interface CategoryRecord` + private
`toDto()` pattern from `categories.service.ts:7-12,48-55`, the partial-update idiom from
`expenses.service.ts:77-81`, `JwtAuthGuard` and `@CurrentUser()`, `ParseUUIDPipe` from
`ExpensesController`.

## Order of work (backend)

1. `schema.prisma` → `pnpm db:migrate` → `pnpm db:generate`
2. `packages/shared/src/types/category.ts`
3. Validator → DTO → service → controller
4. Fix the ricochet in `expenses.service.ts` (until then `tsc` is red)
5. `seed.ts` → `pnpm db:seed`
6. Tests

## Pitfalls

- **`import type` breaks Nest DI.** `UpdateCategoryDto` in `@Body()` and anything appearing in a
  constructor signature is imported as a value (CLAUDE.md records this separately).
- **`@MaxLength` on emoji counts UTF-16 code units**, not graphemes — see the decision above.
- **A uniqueness check that does not exclude the row itself** gives a 409 when saving without
  a rename.

## Tests

**`categories.service.spec.ts`** — new, modelled on `expenses.service.spec.ts`
(a `createPrismaMock()` factory + `Test.createTestingModule`). `update` is the riskiest
new logic:

- renaming to a name taken by another category → 409
- saving with the name unchanged → success (a regression test for excluding the row itself)
- `update` by another user's id → 404
- a partial update leaves the other columns alone
- `findAll` returns `expenseCount` from `_count`

**A DTO unit test** — running `validate()` over `CreateCategoryDto`: `"🛒"` and `"👨‍👩‍👧‍👦"`
(11 code units, 1 grapheme) and `"🇺🇸"` pass; `"ab"`, `"🛒🚌"` and a plain letter do not.

## Verification

```bash
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

`pnpm typecheck` is the real safety net for the `CategoryDto` edit: it is red in `packages/shared`,
`categories.service.ts` and `expenses.service.ts` until all three carry `icon`.

Backend, against a live DB (Swagger at http://localhost:3001/api/docs):

1. `POST /api/categories` with `{ "name": "Travel", "icon": "✈️", "color": "#0ea5e9" }` → 201, `icon` in the response
2. The same body again → 409
3. `POST` with `{ "name": "Bad", "icon": "ab" }` → 400 `icon must be a single emoji`;
   repeated with `"👨‍👩‍👧‍👦"` and `"🇺🇸"` → both 201 (the cases that break a naive length cap
   and a bare `Extended_Pictographic` check respectively)
4. `PATCH /api/categories/:id` with `{ "color": "#ef4444" }` → 200, name and icon unchanged
5. `PATCH` with the category's own current name → 200, not 409
6. `PATCH` / `DELETE` with a second user's token against the first user's category id → 404
7. Any of the four endpoints without an `Authorization` header → 401 (the guard check)
8. `DELETE` a category that has expenses → 204; `GET /api/expenses` shows those rows with `categoryId: null`

## Beyond the assignment: frontend

The assignment describes only the entity, the service and the controller. What follows is done
additionally, because otherwise the new CRUD cannot be used from the application: the `/categories`
page (list, search by name, add, edit, delete with confirmation) and the expense filter by category
on `/expenses`. Decisions confirmed with the user: "filter" means **filtering the expenses table by
category** (search by name lives on the categories page); for emoji we take a **real picker library**;
deletion keeps the current `SetNull` behaviour but gains a confirmation that names the consequence.

### Decisions

**Search and filtering happen on the client.** `findAll` already puts all of the user's categories into
the TanStack Query cache, and expenses are unpaginated. A server-side `?search=` would require a query
DTO and cache-key juggling while buying nothing at these sizes. That is exactly why the assignment's
"find" is `findAll` rather than a parameterised endpoint.

**A category mutation invalidates both `["categories"]` and `["expenses"]`.** This is the feature's
main trap: `ExpenseDto` contains a snapshot of the category, so without the second invalidation a
renamed or recoloured category keeps rendering the old way in the expenses table. `tsc` will not
catch this.

**Form components are written by hand, modelled on `login/page.tsx`.** `src/components/ui/` is empty
apart from `.gitkeep`. Installing shadcn for this feature would be scope creep.

### Choosing the emoji library

`emoji-picker-react@^4.19.1`. Verified against the npm registry, not from memory:

| Package             | Why not it                                                     |
| ------------------- | -------------------------------------------------------------- |
| `@emoji-mart/react` | peer `react "^16.8 \|\| ^17 \|\| ^18"` — React 19 not declared |
| `frimousse`         | pulls emojibase data from a CDN at runtime                     |

`emoji-picker-react` declares `react >=16`, has one transitive dependency (`flairup`)
and ships the dataset inside the package — 4.19.1 unpacks to 34 MB across 369 files, which is
impossible without bundled data.

Two install-config checks, both already passed:

- no postinstall script → **no `allowBuilds` entry needed**
- 4.19.1 was published 2026-04-27, three months ago → it is outside any `minimumReleaseAge` window,
  so **no `minimumReleaseAgeExclude` entry either**

We load it lazily so the dataset does not land in the main bundle:

```ts
const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });
```

**Alongside that you MUST NOT write `import { EmojiStyle }`.** `EmojiStyle` is a runtime enum, not a type:
a static import drags the whole module into the main bundle and silently nullifies `dynamic()`.
We pass a string literal instead: `emojiStyle="native"`.

### Files

- `package.json` — `emoji-picker-react@^4.19.1`
- `src/lib/queries/categories.ts` — new: `categoriesQueryOptions` and the mutation functions,
  so the categories page and the expense filter share one cache key
- `src/app/categories/page.tsx` — new page
- `src/app/expenses/page.tsx` — the filter chips
- `src/app/page.tsx` — a "Categories" link (the project has no navigation at all)

Reused: `apiClient` / `ApiError` (`src/lib/api-client.ts`), the `useForm` + `zodResolver` pattern
and the inline Tailwind classes from `src/app/login/page.tsx`.

### Behaviour

**`/categories`** (`"use client"`):

- `useQuery(["categories"])` → `CategoryListItemDto[]`
- **Search** — a controlled input, filtered on the client by
  `name.toLowerCase().includes(...)`
- **A list row** — the emoji (or a neutral placeholder), the name, a colour swatch,
  `expenseCount`, and edit and delete buttons
- **The add/edit form** — one component for both scenarios:
  - name — `z.string().min(1).max(50)`
  - colour — an `<input type="color">` next to a "No color" button. `type="color"` always
    returns a value (`#000000` by default), so without that button `null` is unreachable
  - icon — a button showing the current emoji that expands `EmojiPicker`, plus "Remove icon".
    `onEmojiClick` hands back `{ emoji }` — that is the character to send
- **Deletion** — a confirmation that names the consequence: "Delete Groceries?" / "Its 12 expenses
  will remain, but become uncategorized." We use a `<dialog>` or inline state rather than
  `window.confirm` — the browser modal blocks the event loop and is untestable
- **Invalidation** — after every mutation, invalidate `["categories"]` **and** `["expenses"]`

**`/expenses`** — a row of chips: "All", one chip per category (emoji + name + counter, tinted with
its colour) and "Uncategorized". Filtering happens on the client over the already-loaded expenses
(`categoryId === selected`, or `=== null`). The record counter in the header and the `sumAmounts`
total recompute over the filtered set — that is the useful behaviour.

### Order and checks

Installed after the backend: `pnpm --filter @expense-tracker/frontend add emoji-picker-react` →
`lib/queries/categories.ts` → `/categories` → the filter on `/expenses` → the links.

Manual checks (`pnpm dev`, logging in as `demo@example.com` / `password123`):

1. `/categories` shows the four seeded categories with emoji, colours and counters
2. Typing "gro" into search → only Groceries
3. Adding a category through the emoji picker — it appears without a manual page refresh
4. Changing the colour of Groceries → on `/expenses` the dot is the **new** colour (the `["expenses"]` invalidation check)
5. Deleting a category → the confirmation names the number of expenses; after confirming, its expenses
   on `/expenses` read as "Uncategorized"
6. Clicking a category chip on `/expenses` → the table, the record counter and the total narrow to it;
   "Uncategorized" shows the detached rows

## Out of scope

- **There is no bulk `DELETE /api/categories`** — "deleting all of the user's categories" in the assignment
  means the CRUD is scoped to one's own categories, not deletion in a single request.
- **No server-side search or filtering** — neither `?search=` nor `?categoryId=`.
  With no pagination, everything is already in the client cache.
- **Deletion behaviour does not change** — `onDelete: SetNull` stays, expenses survive
  and become uncategorized. We do not forbid deleting categories that are in use.
- **No shadcn components are installed** — `src/components/ui/` stays empty, and the forms are written
  modelled on `login/page.tsx`.
- **`CategoriesService` is not moved onto CQRS** — like `ExpensesService`, it injects
  `PrismaService` directly; CLAUDE.md records this as a deliberate decision scoped to the
  users module.
- **There is no separate category ownership guard** — ownership is checked in the service via
  `where: { id, userId }`, as everywhere else in the project.
- **Category ordering and grouping, per-category budgets, icons from a set instead of emoji** —
  not included.
