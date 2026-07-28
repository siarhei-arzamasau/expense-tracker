"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { AuthResponse } from "@expense-tracker/shared";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { ApiError } from "@/lib/api-client";
import { authStorage } from "@/lib/auth-storage";
import { register as registerUser } from "@/lib/queries/auth";
import { registerSchema, type RegisterValues } from "@/lib/validation/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

export function RegisterForm() {
  const router = useRouter();

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const mutation = useMutation({
    // Two adjustments before this reaches the wire: `confirmPassword` and
    // `acceptTerms` are client-only fields RegisterInput doesn't have, and the
    // backend's ValidationPipe runs with forbidNonWhitelisted — sending them
    // as-is would 400. And a blank Name is "not provided," not "provided as
    // empty" — RegisterInput.name is optional, and UsersService.create does
    // `name: input.name ?? null`, so sending "" would store an empty string
    // instead of the null the rest of the app treats as "no name."
    mutationFn: ({
      confirmPassword: _confirmPassword,
      acceptTerms: _acceptTerms,
      ...values
    }: RegisterValues) => registerUser({ ...values, name: values.name || undefined }),
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
                <PasswordInput autoComplete="new-password" {...field} />
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
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="acceptTerms"
          render={({ field }) => (
            // Not the default FormItem grid: the checkbox and its label belong
            // on one line, with the message underneath the text rather than
            // beside the box.
            <FormItem className="flex items-start gap-3">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div className="grid gap-1">
                {/* The whole sentence sits inside the label so the checkbox's
                    accessible name is the full agreement rather than "I agree
                    to the". The two links can stay nested: a label does not
                    activate its control for clicks targeting an interactive
                    descendant, so following one does not also tick the box.
                    `block` overrides the Label default `flex`, which would
                    turn each text run and link into its own flex item on one
                    unwrappable row instead of one wrapping sentence. */}
                <FormLabel className="block text-sm leading-snug font-normal">
                  I agree to the{" "}
                  <Link href="/terms" className="underline underline-offset-4 hover:text-primary">
                    Terms and Conditions
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">
                    Privacy Policy
                  </Link>
                </FormLabel>
                <FormMessage />
              </div>
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
