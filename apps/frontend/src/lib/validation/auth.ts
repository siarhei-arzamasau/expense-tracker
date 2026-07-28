import { z } from "zod";

// z.string().email() rather than Zod 4's newer top-level z.email(): it is
// valid in both Zod 3 and 4, matching the existing login/page.tsx.
const email = z.string().email("Enter a valid email address");
// Mirrors RegisterDto's bounds so a password rejected on submit was never
// going to pass the backend either.
const newPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().max(100, "Name must be at most 100 characters").optional(),
    email,
    password: newPassword,
    confirmPassword: z.string(),
    // A boolean refined to true rather than z.literal(true): the literal's
    // inferred `true` type cannot represent the unchecked default the form
    // starts with, and its rejection message is not this specific.
    acceptTerms: z.boolean().refine((accepted) => accepted, {
      message: "Accept the Terms and Conditions and Privacy Policy to continue",
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email,
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
