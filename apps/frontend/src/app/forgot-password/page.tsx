"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { ApiError } from "@/lib/api-client";
import { requestPasswordReset } from "@/lib/queries/auth";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AuthBrand } from "@/components/auth/auth-brand";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const mutation = useMutation({ mutationFn: requestPasswordReset });

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <AuthBrand tagline="Enter your email and we'll send a link to set a new password." />
      <Card>
        <CardContent>
          {mutation.isSuccess ? (
            <Alert>
              <AlertDescription>
                If an account with that email exists, a reset link has been sent. In this template
                the link is written to the backend server log rather than emailed.
              </AlertDescription>
            </Alert>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {mutation.error && (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>
                      {mutation.error instanceof ApiError
                        ? mutation.error.message
                        : "Something went wrong"}
                    </AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={mutation.isPending} className="w-full">
                  {mutation.isPending ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
