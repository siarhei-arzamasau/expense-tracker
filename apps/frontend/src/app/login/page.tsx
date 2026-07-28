"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// The active tab still lives in useState rather than the URL — reading it
// back would need its own useSearchParams call for no real benefit. The
// ?reset=success banner below needs useSearchParams regardless, which is
// what pulls in the Suspense boundary this page couldn't otherwise avoid.
function LoginPageContent() {
  const [tab, setTab] = useState("login");
  const resetSucceeded = useSearchParams().get("reset") === "success";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Expense Tracker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {resetSucceeded && (
          <Alert>
            <AlertDescription>
              Your password has been reset. Log in with your new password.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="login">Log in</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          {/* forceMount: Radix unmounts inactive tab content by default,
              which would clear whatever was typed into the other form on
              every switch. Keeping both mounted preserves it. */}
          <TabsContent value="login" className="pt-4" forceMount>
            <LoginForm />
          </TabsContent>
          <TabsContent value="register" className="pt-4" forceMount>
            <RegisterForm />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Suspense fallback={null}>
        <LoginPageContent />
      </Suspense>
    </main>
  );
}
