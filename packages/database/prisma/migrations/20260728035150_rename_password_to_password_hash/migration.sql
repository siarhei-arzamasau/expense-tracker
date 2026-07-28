-- Hand-written on purpose.
--
-- `prisma migrate dev` generates DROP COLUMN "password" + ADD COLUMN "passwordHash"
-- for this change, which destroys every stored hash and locks all existing users
-- out of their accounts. It also refuses to run non-interactively once it notices
-- the data loss. A rename preserves the values and is what we actually meant.
ALTER TABLE "users" RENAME COLUMN "password" TO "passwordHash";
