"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type {
  ChangePasswordInput,
  DeleteAccountInput,
  UpdateProfileInput,
} from "@expense-tracker/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ApiError } from "@/lib/api-client";
import { useLogout } from "@/lib/use-logout";
import {
  changePassword,
  currentUserQueryKey,
  currentUserQueryOptions,
  deleteAccount,
  updateProfile,
} from "@/lib/queries/user";

const profileSchema = z.object({
  name: z.string().max(100, "Name must be at most 100 characters"),
  email: z.string().email("Enter a valid email address"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be at most 72 characters"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;
type DeleteAccountValues = z.infer<typeof deleteAccountSchema>;

function errorMessage(error: Error | null, fallback: string): string | null {
  if (!error) return null;
  return error instanceof ApiError ? error.message : fallback;
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const logout = useLogout();
  const {
    data: user,
    error: userError,
    isPending: isUserPending,
  } = useQuery(currentUserQueryOptions);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", email: "" },
  });
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const deletionForm = useForm<DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: "" },
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({ name: user.name ?? "", email: user.email });
    }
  }, [profileForm, user]);

  const profileMutation = useMutation({
    mutationFn: (values: ProfileValues) => {
      const input: UpdateProfileInput = {
        name: values.name.trim() || null,
        email: values.email.trim(),
      };
      return updateProfile(input);
    },
    onSuccess: (updatedUser) => {
      // PATCH returns the saved user, so seeding the cache with it is the whole
      // update — an invalidate here would only spend a round trip re-fetching
      // what we are already holding, and the shell's header would flicker.
      queryClient.setQueryData(currentUserQueryKey, updatedUser);
      profileForm.reset({ name: updatedUser.name ?? "", email: updatedUser.email });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordValues) => {
      const input: ChangePasswordInput = {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      };
      return changePassword(input);
    },
    onSuccess: () => passwordForm.reset(),
  });

  const deleteMutation = useMutation({
    mutationFn: (values: DeleteAccountValues) => {
      const input: DeleteAccountInput = { password: values.password };
      return deleteAccount(input);
    },
    onSuccess: () => {
      deletionForm.reset();
      logout();
    },
  });

  if (isUserPending) {
    return (
      <main className="w-full max-w-3xl px-5 py-7 sm:px-7 lg:px-9 lg:py-9" aria-busy="true">
        <div className="bg-secondary h-8 w-36 animate-pulse rounded-full" />
        <div className="bg-secondary rounded-panel mt-8 h-64 animate-pulse" />
        <span className="sr-only">Loading profile</span>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="w-full max-w-3xl px-5 py-7 sm:px-7 lg:px-9 lg:py-9">
        {userError && !(userError instanceof ApiError && userError.isUnauthorized) && (
          <Alert variant="destructive">
            <AlertDescription>
              {errorMessage(userError, "Could not load your profile")}
            </AlertDescription>
          </Alert>
        )}
      </main>
    );
  }

  return (
    <main className="w-full max-w-3xl space-y-6 px-5 py-7 sm:px-7 lg:px-9 lg:py-9">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="mt-2 text-[1.75rem] leading-none font-bold">Profile</h1>
          <p className="text-muted-foreground mt-2.5 text-sm">
            Manage your account details and security.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={logout}>
          Log out
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Update the name and email shown on your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form
              className="space-y-4"
              noValidate
              onSubmit={profileForm.handleSubmit((values) => profileMutation.mutate(values))}
            >
              <FormField
                control={profileForm.control}
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
                control={profileForm.control}
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
              {profileMutation.error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {errorMessage(profileMutation.error, "Could not update your profile")}
                  </AlertDescription>
                </Alert>
              )}
              {profileMutation.isSuccess && (
                <p className="text-income-ink text-[0.8125rem] font-medium" role="status">
                  Profile updated.
                </p>
              )}
              <Button
                type="submit"
                disabled={profileMutation.isPending || !profileForm.formState.isDirty}
              >
                {profileMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Use at least 8 characters for your new password.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form
              className="space-y-4"
              noValidate
              onSubmit={passwordForm.handleSubmit((values) => passwordMutation.mutate(values))}
            >
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current password</FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {passwordMutation.error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {errorMessage(passwordMutation.error, "Could not change your password")}
                  </AlertDescription>
                </Alert>
              )}
              {passwordMutation.isSuccess && (
                <p className="text-income-ink text-[0.8125rem] font-medium" role="status">
                  Password changed.
                </p>
              )}
              <Button type="submit" disabled={passwordMutation.isPending}>
                {passwordMutation.isPending ? "Updating…" : "Change password"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="border-destructive/25 border">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>
            Permanently delete your account, categories, and transactions. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...deletionForm}>
            <form
              className="space-y-4"
              noValidate
              onSubmit={deletionForm.handleSubmit((values) => deleteMutation.mutate(values))}
            >
              <FormField
                control={deletionForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm your password</FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {deleteMutation.error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {errorMessage(deleteMutation.error, "Could not delete your account")}
                  </AlertDescription>
                </Alert>
              )}
              <Button type="submit" variant="destructive" disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Deleting…" : "Delete account permanently"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
