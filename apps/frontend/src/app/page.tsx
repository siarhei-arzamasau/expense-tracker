import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">Expense Tracker</h1>
        <p className="text-muted-foreground text-lg">
          Next.js frontend, NestJS backend, PostgreSQL via Prisma.
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/expenses"
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
        >
          View expenses
        </Link>
        <Link
          href="/categories"
          className="border-border rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          Categories
        </Link>
        <Link
          href="/login"
          className="border-border rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          Log in
        </Link>
      </div>

      <p className="text-muted-foreground text-sm">
        Seeded account: <code className="font-mono">demo@example.com</code> /{" "}
        <code className="font-mono">password123</code>
      </p>
    </main>
  );
}
