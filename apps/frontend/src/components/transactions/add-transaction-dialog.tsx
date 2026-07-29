"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  TRANSACTION_TYPES,
  type CategoryListItemDto,
  type CreateTransactionInput,
} from "@expense-tracker/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog } from "radix-ui";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { categoriesQueryKey } from "@/lib/queries/categories";
import { createTransaction, transactionQueryKeys } from "@/lib/queries/transactions";

const transactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  amount: z
    .string()
    .trim()
    .min(1, "Amount is required")
    .refine(
      (value) => /^\d+(?:\.\d{1,2})?$/.test(value),
      "Use a positive amount with up to 2 decimals",
    )
    .refine((value) => Number(value) > 0, "Amount must be greater than zero")
    .refine((value) => Number(value) <= 9_999_999_999, "Amount is too large"),
  categoryId: z.string().min(1, "Choose a category"),
  date: z.string().min(1, "Date is required"),
  description: z.string().max(255, "Use 255 characters or fewer"),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

interface AddTransactionDialogProps {
  categories: CategoryListItemDto[];
  triggerLabel?: string;
}

function defaultDate(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

/**
 * Called fresh on every reset, never hoisted to a constant: `defaultDate()`
 * must be today's date each time the dialog opens, not the date the module was
 * first evaluated.
 */
function blankTransaction(categories: CategoryListItemDto[]): TransactionFormValues {
  return {
    type: "EXPENSE",
    amount: "",
    categoryId: categories[0]?.id ?? "",
    date: defaultDate(),
    description: "",
  };
}

export function AddTransactionDialog({
  categories,
  triggerLabel = "Add transaction",
}: AddTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: blankTransaction(categories),
  });

  const mutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: transactionQueryKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: transactionQueryKeys.summaries() }),
        queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
      ]);
      reset(blankTransaction(categories));
      setOpen(false);
    },
  });

  const handleOpenChange = (nextOpen: boolean): void => {
    if (nextOpen) {
      mutation.reset();
      reset(blankTransaction(categories));
    }
    setOpen(nextOpen);
  };

  const submit = (values: TransactionFormValues): void => {
    const input: CreateTransactionInput = {
      type: values.type,
      amount: Number(values.amount),
      categoryId: values.categoryId,
      date: `${values.date}T00:00:00.000Z`,
      ...(values.description.trim() && { description: values.description.trim() }),
    };
    mutation.mutate(input);
  };

  const hasCategories = categories.length > 0;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button type="button">
          <Plus aria-hidden />
          {triggerLabel}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px]" />
        <Dialog.Content className="bg-background rounded-panel shadow-panel fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-7 focus:outline-none">
          <div className="pr-10">
            <Dialog.Title className="font-display text-xl font-semibold tracking-tight">
              Add transaction
            </Dialog.Title>
            <Dialog.Description className="text-muted-foreground mt-1.5 text-sm">
              Record income or an expense in your account.
            </Dialog.Description>
          </div>
          <Dialog.Close asChild>
            <Button
              className="absolute top-5 right-5"
              size="icon-sm"
              variant="ghost"
              aria-label="Close dialog"
            >
              <X aria-hidden />
            </Button>
          </Dialog.Close>

          {!hasCategories && (
            <div className="bg-secondary mt-6 rounded-2xl p-4 text-sm">
              <p>You need a category before you can add a transaction.</p>
              <Link
                href="/categories"
                className="mt-2 inline-block font-semibold underline underline-offset-4"
              >
                Create a category
              </Link>
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit(submit)} noValidate>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-2 text-[0.8125rem] font-semibold">
                <span>Type</span>
                <select
                  {...register("type")}
                  className="bg-secondary focus-visible:bg-background focus-visible:ring-ring/70 h-10 w-full rounded-full border border-transparent px-4 text-sm font-normal transition-[background-color,border-color,box-shadow] outline-none focus-visible:border-input focus-visible:ring-[3px]"
                >
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>
              </label>
              <label className="space-y-2 text-[0.8125rem] font-semibold">
                <span>Amount</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-invalid={!!errors.amount}
                  {...register("amount")}
                />
                {errors.amount && (
                  <span className="text-destructive block text-xs font-medium">
                    {errors.amount.message}
                  </span>
                )}
              </label>
            </div>

            <label className="block space-y-2 text-[0.8125rem] font-semibold">
              <span>Category</span>
              <select
                {...register("categoryId")}
                disabled={!hasCategories}
                aria-invalid={!!errors.categoryId}
                className="bg-secondary focus-visible:bg-background focus-visible:ring-ring/70 h-10 w-full rounded-full border border-transparent px-4 text-sm font-normal transition-[background-color,border-color,box-shadow] outline-none focus-visible:border-input focus-visible:ring-[3px] disabled:opacity-45"
              >
                {!hasCategories && <option value="">No categories available</option>}
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon ? `${category.icon} ` : ""}
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <span className="text-destructive block text-xs">{errors.categoryId.message}</span>
              )}
            </label>

            <label className="block space-y-2 text-[0.8125rem] font-semibold">
              <span>Date</span>
              <Input type="date" aria-invalid={!!errors.date} {...register("date")} />
              {errors.date && (
                <span className="text-destructive block text-xs">{errors.date.message}</span>
              )}
            </label>

            <label className="block space-y-2 text-[0.8125rem] font-semibold">
              <span>
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </span>
              <Input
                placeholder="What was this for?"
                aria-invalid={!!errors.description}
                {...register("description")}
              />
              {errors.description && (
                <span className="text-destructive block text-xs">{errors.description.message}</span>
              )}
            </label>

            {mutation.error && (
              <p className="text-destructive text-sm" role="alert">
                {mutation.error instanceof ApiError
                  ? mutation.error.message
                  : "Could not create transaction."}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={!hasCategories || mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Add transaction"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export type { AddTransactionDialogProps };
