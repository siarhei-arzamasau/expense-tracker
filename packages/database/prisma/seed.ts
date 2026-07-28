/* eslint-disable no-console -- a seed script is meant to talk to the terminal */
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
];

const EXPENSES = [
  { amount: "82.40", description: "Weekly shop", category: "Groceries", daysAgo: 1 },
  { amount: "2.90", description: "Metro ticket", category: "Transport", daysAgo: 1 },
  { amount: "45.00", description: "Dinner out", category: "Dining", daysAgo: 3 },
  { amount: "120.15", description: "Electricity bill", category: "Utilities", daysAgo: 6 },
  { amount: "31.75", description: "Corner store", category: "Groceries", daysAgo: 8 },
  { amount: "18.00", description: "Taxi home", category: "Transport", daysAgo: 12 },
  { amount: "9.60", description: "Coffee and pastry", category: "Dining", daysAgo: 14 },
];

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

  // Expenses have no natural key to upsert on, so re-running replaces them.
  await prisma.expense.deleteMany({ where: { userId: user.id } });

  await prisma.expense.createMany({
    data: EXPENSES.map((expense) => ({
      amount: expense.amount,
      description: expense.description,
      spentAt: daysAgo(expense.daysAgo),
      userId: user.id,
      categoryId: categoryIdByName.get(expense.category) ?? null,
    })),
  });

  console.log(`Seeded ${categories.length} categories and ${EXPENSES.length} expenses.`);
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
