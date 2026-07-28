"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm } from "react-hook-form";

import { ApiError } from "@/lib/api-client";
import { resetPassword } from "@/lib/queries/auth";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/validation/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: ResetPasswordValues) =>
      resetPassword({ token, password: values.password }),
    onSuccess: () => {
      router.push("/login?reset=success");
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm new password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {mutation.error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {mutation.error instanceof ApiError ? mutation.error.message : "Something went wrong"}
            </AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={mutation.isPending} className="w-full">
          {mutation.isPending ? "Resetting…" : "Reset password"}
        </Button>
      </form>
    </Form>
  );
}

function ResetPasswordGate() {
  const token = useSearchParams().get("token") ?? "";

  // A missing or truncated token would otherwise walk the user through the
  // whole form only to fail on submit with class-validator's raw message
  // ("token must be longer than or equal to 43 characters") — the plan
  // commits to one message for every reset failure, so this catches it
  // before the request ever goes out. Gating here, rather than with an
  // early return inside ResetPasswordForm, keeps that component's Hook
  // calls unconditional.
  if (token.length !== 43) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>Reset link is invalid or has expired</AlertDescription>
      </Alert>
    );
  }

  return <ResetPasswordForm token={token} />;
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Reset password</CardTitle>
        </CardHeader>
        <CardContent>
          {/* useSearchParams needs a Suspense boundary in a client component
              under Next 16's static rendering, or `next build` fails. */}
          <Suspense fallback={null}>
            <ResetPasswordGate />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
