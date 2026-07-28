CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

ALTER TABLE "expenses" RENAME TO "transactions";
ALTER TABLE "transactions" RENAME COLUMN "spentAt" TO "date";
ALTER TABLE "transactions" DROP COLUMN "updatedAt";

-- Every pre-existing row was an expense by definition; the default only exists
-- to fill them, then goes away so new rows must state their type.
ALTER TABLE "transactions" ADD COLUMN "type" "TransactionType" NOT NULL DEFAULT 'EXPENSE';
ALTER TABLE "transactions" ALTER COLUMN "type" DROP DEFAULT;

-- categoryId was nullable and is now required. No-op on seeded data (all rows
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
