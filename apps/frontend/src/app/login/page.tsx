"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { API_ROUTES, type AuthResponse } from "@expense-tracker/shared";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { apiClient, ApiError } from "@/lib/api-client";
import { authStorage } from "@/lib/auth-storage";

// z.string().email() rather than Zod 4's newer top-level z.email(): it is valid
// in both Zod 3 and 4, so bumping zod either direction will not break this file.
const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "demo@example.com", password: "password123" },
  });

  const login = useMutation({
    mutationFn: (values: LoginValues) =>
      apiClient.post<AuthResponse>(API_ROUTES.auth.login, values),
    onSuccess: (data) => {
      authStorage.set(data.accessToken);
      router.push("/expenses");
    },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
        <p className="text-muted-foreground text-sm">Use the seeded demo account, or register.</p>
      </div>

      <form
        onSubmit={handleSubmit((values) => login.mutate(values))}
        className="space-y-4"
        noValidate
      >
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="border-input w-full rounded-md border px-3 py-2 text-sm"
            {...register("email")}
          />
          {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="border-input w-full rounded-md border px-3 py-2 text-sm"
            {...register("password")}
          />
          {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
        </div>

        {login.error && (
          <p className="text-destructive text-sm" role="alert">
            {login.error instanceof ApiError ? login.error.message : "Something went wrong"}
          </p>
        )}

        <button
          type="submit"
          disabled={login.isPending}
          className="bg-primary text-primary-foreground w-full rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {login.isPending ? "Logging in…" : "Log in"}
        </button>
      </form>
    </main>
  );
}
