"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { AuthResponse } from "@expense-tracker/shared";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { ApiError } from "@/lib/api-client";
import { authStorage } from "@/lib/auth-storage";
import { register as registerUser } from "@/lib/queries/auth";
import { registerSchema, type RegisterValues } from "@/lib/validation/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export function RegisterForm() {
  const router = useRouter();

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    // Two adjustments before this reaches the wire: `confirmPassword` is a
    // client-only field RegisterInput doesn't have, and the backend's
    // ValidationPipe runs with forbidNonWhitelisted — sending it as-is would
    // 400. And a blank Name is "not provided," not "provided as empty" —
    // RegisterInput.name is optional, and UsersService.create does
    // `name: input.name ?? null`, so sending "" would store an empty string
    // instead of the null the rest of the app treats as "no name."
    mutationFn: ({ confirmPassword: _confirmPassword, ...values }: RegisterValues) =>
      registerUser({ ...values, name: values.name || undefined }),
    onSuccess: (data: AuthResponse) => {
      // Registration behaves exactly like login: POST /auth/register already
      // returns an AuthResponse with a token.
      authStorage.set(data.accessToken);
      router.push("/expenses");
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
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
              <FormLabel>Confirm password</FormLabel>
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
          {mutation.isPending ? "Creating account…" : "Register"}
        </Button>
      </form>
    </Form>
  );
}
