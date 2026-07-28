/* oxlint-disable no-console -- a seed script is meant to talk to the terminal */
import { resolve } from "node:path";

import * as argon2 from "argon2";
import { config as loadEnv } from "dotenv";

import { createPrismaClient } from "../src/client";

// Must run before createPrismaClient() below, which reads DATABASE_URL from the
// environment. Import statements hoist, but this top-level code still executes
// before the `const prisma = ...` that follows it.
for (const candidate of ["../../.env", ".env"]) {
  loadEnv({ path: resolve(process.cwd(), candidate), override: false, quiet: true });
}

const prisma = createPrismaClient();

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "password123";

const CATEGORIES = [
  { name: "Groceries", color: "#22c55e", icon: "🛒" },
  { name: "Transport", color: "#3b82f6", icon: "🚌" },
  { name: "Dining", color: "#f97316", icon: "🍽️" },
  { name: "Utilities", color: "#a855f7", icon: "💡" },
  { name: "Salary", color: "#eab308", icon: "💰" },
];

const TRANSACTIONS = [
  {
    amount: "82.40",
    type: "EXPENSE",
    description: "Weekly shop",
    category: "Groceries",
    daysAgo: 1,
  },
  {
    amount: "2.90",
    type: "EXPENSE",
    description: "Metro ticket",
    category: "Transport",
    daysAgo: 1,
  },
  { amount: "45.00", type: "EXPENSE", description: "Dinner out", category: "Dining", daysAgo: 3 },
  {
    amount: "120.15",
    type: "EXPENSE",
    description: "Electricity bill",
    category: "Utilities",
    daysAgo: 6,
  },
  {
    amount: "31.75",
    type: "EXPENSE",
    description: "Corner store",
    category: "Groceries",
    daysAgo: 8,
  },
  {
    amount: "18.00",
    type: "EXPENSE",
    description: "Taxi home",
    category: "Transport",
    daysAgo: 12,
  },
  {
    amount: "9.60",
    type: "EXPENSE",
    description: "Coffee and pastry",
    category: "Dining",
    daysAgo: 14,
  },
  {
    amount: "3200.00",
    type: "INCOME",
    description: "Monthly salary",
    category: "Salary",
    daysAgo: 2,
  },
  {
    amount: "150.00",
    type: "INCOME",
    description: "Freelance invoice",
    category: "Salary",
    daysAgo: 10,
  },
] as const;

/** Dates relative to today, so seeded data always looks recent. */
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(12, 0, 0, 0);
  return date;
}

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: "Demo User",
      passwordHash: await argon2.hash(DEMO_PASSWORD),
    },
  });

  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: category.name } },
      update: { color: category.color, icon: category.icon },
      create: {
        name: category.name,
        color: category.color,
        icon: category.icon,
        userId: user.id,
      },
    });
  }

  const categories = await prisma.category.findMany({ where: { userId: user.id } });
  const categoryIdByName = new Map<string, string>(
    categories.map((category) => [category.name, category.id]),
  );

  // Transactions have no natural key to upsert on, so re-running replaces them.
  await prisma.transaction.deleteMany({ where: { userId: user.id } });

  await prisma.transaction.createMany({
    data: TRANSACTIONS.map((transaction) => {
      const categoryId = categoryIdByName.get(transaction.category);
      // categoryId is required on Transaction — a lookup miss here means the
      // CATEGORIES list above is out of sync with this data, not a case to
      // paper over with a fallback.
      if (!categoryId) {
        throw new Error(`Seed category "${transaction.category}" was not created`);
      }
      return {
        amount: transaction.amount,
        type: transaction.type,
        description: transaction.description,
        date: daysAgo(transaction.daysAgo),
        userId: user.id,
        categoryId,
      };
    }),
  });

  console.log(`Seeded ${categories.length} categories and ${TRANSACTIONS.length} transactions.`);
  console.log(`Log in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
