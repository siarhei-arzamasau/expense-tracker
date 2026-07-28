import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder, not legal text. The register form has to link somewhere, and a
// link into a 404 is worse than an honest stub. Replace the body wholesale if
// this app ever collects real users.
export const metadata = { title: "Terms and Conditions" };

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Terms and Conditions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Expense Tracker is a learning template. It is provided as-is, with no warranty and no
            service commitment, and the data you enter may be deleted at any time.
          </p>
          <p>
            These are not real terms of service. An application that collects real users needs terms
            written for it; this page exists so the registration form has somewhere to point.
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
