import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder, not a legal privacy notice — same reasoning as app/terms/page.tsx.
export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Expense Tracker stores the name, email and expense records you enter in a local
            PostgreSQL database. Passwords are stored only as argon2 hashes. Nothing is shared with
            a third party, because there is no third party — this template runs entirely on the
            machine that hosts it.
          </p>
          <p>
            Deleting your account removes your categories and expenses with it. This is not a real
            privacy notice; an application that collects real users needs one written for it.
          </p>
          <p>
            <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
