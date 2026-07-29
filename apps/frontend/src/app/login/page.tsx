"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthBrand } from "@/components/auth/auth-brand";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
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
              every switch. Keeping both mounted preserves it — but forceMount
              also suppresses the `hidden` attribute Radix would otherwise set,
              so the inactive panel has to be hidden here or both forms render
              stacked on top of each other. display:none (not visibility or
              opacity) is what keeps the hidden form out of the tab order and
              the accessibility tree while its React state survives. */}
          <TabsContent value="login" className="pt-5 data-[state=inactive]:hidden" forceMount>
            <LoginForm />
          </TabsContent>
          <TabsContent value="register" className="pt-5 data-[state=inactive]:hidden" forceMount>
            <RegisterForm />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <AuthBrand tagline="Log in to see where the money went, or create an account to start." />
      <Suspense fallback={null}>
        <LoginPageContent />
      </Suspense>
    </main>
  );
}
