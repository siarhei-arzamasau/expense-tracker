"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type {
  CategoryListItemDto,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@expense-tracker/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EmojiStyle } from "emoji-picker-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { ApiError } from "@/lib/api-client";
import { authStorage } from "@/lib/auth-storage";
import {
  categoriesQueryOptions,
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/queries/categories";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Use 50 characters or fewer"),
  color: z.string().nullable(),
  icon: z.string().nullable(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  category?: CategoryListItemDto;
  error: Error | null;
  isPending: boolean;
  onCancel?: () => void;
  onSubmit: (values: CategoryFormValues) => void;
}

function CategoryForm({ category, error, isPending, onCancel, onSubmit }: CategoryFormProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? "",
      color: category?.color ?? "#64748b",
      icon: category?.icon ?? null,
    },
  });

  const color = useWatch({ control, name: "color" });
  const icon = useWatch({ control, name: "icon" });

  return (
    <form
      className="border-border bg-card space-y-4 rounded-lg border p-4"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div className="space-y-1.5">
        <label htmlFor={`category-name-${category?.id ?? "new"}`} className="text-sm font-medium">
          Name
        </label>
        <input
          id={`category-name-${category?.id ?? "new"}`}
          className="border-input w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Category name"
          {...register("name")}
        />
        {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Color</span>
          <div className="flex items-center gap-2">
            <input
              aria-label="Category color"
              type="color"
              value={color ?? "#64748b"}
              onChange={(event) => setValue("color", event.target.value, { shouldDirty: true })}
              className="border-input h-9 w-12 cursor-pointer rounded border bg-transparent p-1"
            />
            <button
              type="button"
              onClick={() => setValue("color", null, { shouldDirty: true })}
              className="border-border rounded-md border px-3 py-2 text-xs hover:bg-accent"
            >
              No color
            </button>
            {color === null && <span className="text-muted-foreground text-xs">None</span>}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium">Icon</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-expanded={pickerOpen}
              onClick={() => setPickerOpen((open) => !open)}
              className="border-border min-w-12 rounded-md border px-3 py-2 text-lg hover:bg-accent"
            >
              {icon ?? "＋"}
            </button>
            <button
              type="button"
              onClick={() => {
                setValue("icon", null, { shouldDirty: true });
                setPickerOpen(false);
              }}
              className="border-border rounded-md border px-3 py-2 text-xs hover:bg-accent"
            >
              Remove icon
            </button>
          </div>
        </div>
      </div>

      {pickerOpen && (
        <div className="max-w-full overflow-hidden rounded-lg">
          <EmojiPicker
            emojiStyle={"native" as EmojiStyle}
            width="100%"
            onEmojiClick={({ emoji }) => {
              setValue("icon", emoji, { shouldDirty: true });
              setPickerOpen(false);
            }}
          />
        </div>
      )}

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error instanceof ApiError ? error.message : "Could not save category"}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="border-border rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? "Saving…" : category ? "Save changes" : "Add category"}
        </button>
      </div>
    </form>
  );
}

export default function CategoriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CategoryListItemDto | null>(null);
  const [deleting, setDeleting] = useState<CategoryListItemDto | null>(null);
  const [newFormKey, setNewFormKey] = useState(0);

  const { data: categories, isPending, error } = useQuery(categoriesQueryOptions);

  const invalidateCategoryData = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
      queryClient.invalidateQueries({ queryKey: ["expenses"] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      await invalidateCategoryData();
      setNewFormKey((key) => key + 1);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateCategory,
    onSuccess: async () => {
      await invalidateCategoryData();
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: async () => {
      await invalidateCategoryData();
      setDeleting(null);
    },
  });

  useEffect(() => {
    if (error instanceof ApiError && error.isUnauthorized) {
      authStorage.clear();
      router.push("/login");
    }
  }, [error, router]);

  const filteredCategories =
    categories?.filter((category) =>
      category.name.toLowerCase().includes(search.trim().toLowerCase()),
    ) ?? [];

  const handleCreate = (values: CategoryFormValues): void => {
    const input: CreateCategoryInput = {
      name: values.name,
      ...(values.color !== null && { color: values.color }),
      ...(values.icon !== null && { icon: values.icon }),
    };
    createMutation.mutate(input);
  };

  const handleUpdate = (values: CategoryFormValues): void => {
    if (!editing) return;
    const input: UpdateCategoryInput = values;
    updateMutation.mutate({ id: editing.id, input });
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Organize expenses with a name, color, and emoji.
          </p>
        </div>
        <Link href="/expenses" className="text-sm font-medium underline underline-offset-4">
          View expenses
        </Link>
      </header>

      <section aria-labelledby="add-category-heading" className="mb-8 space-y-3">
        <h2 id="add-category-heading" className="text-lg font-semibold">
          Add category
        </h2>
        <CategoryForm
          key={newFormKey}
          error={createMutation.error}
          isPending={createMutation.isPending}
          onSubmit={handleCreate}
        />
      </section>

      <section aria-labelledby="category-list-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="category-list-heading" className="text-lg font-semibold">
              Your categories
            </h2>
            {categories && (
              <p className="text-muted-foreground text-sm">{categories.length} total</p>
            )}
          </div>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Search</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name"
              className="border-input block rounded-md border px-3 py-2 text-sm"
            />
          </label>
        </div>

        {isPending && <p className="text-muted-foreground text-sm">Loading…</p>}
        {error && !(error instanceof ApiError && error.isUnauthorized) && (
          <p className="text-destructive text-sm" role="alert">
            {error instanceof ApiError ? error.message : "Could not load categories"}
          </p>
        )}
        {categories && filteredCategories.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {search ? "No categories match your search." : "No categories yet."}
          </p>
        )}

        <div className="space-y-3">
          {filteredCategories.map((category) => (
            <div key={category.id} className="space-y-3">
              <div className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-4">
                <span
                  aria-hidden
                  className="flex size-10 items-center justify-center rounded-full text-xl"
                  style={{ backgroundColor: category.color ?? "var(--muted)" }}
                >
                  {category.icon ?? "•"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{category.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {category.expenseCount} {category.expenseCount === 1 ? "expense" : "expenses"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(category)}
                  className="border-border rounded-md border px-3 py-2 text-sm hover:bg-accent"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(category)}
                  className="text-destructive border-border rounded-md border px-3 py-2 text-sm hover:bg-accent"
                >
                  Delete
                </button>
              </div>
              {editing?.id === category.id && (
                <CategoryForm
                  category={editing}
                  error={updateMutation.error}
                  isPending={updateMutation.isPending}
                  onCancel={() => setEditing(null)}
                  onSubmit={handleUpdate}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {deleting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-category-title"
            className="bg-background w-full max-w-md space-y-4 rounded-lg p-6 shadow-xl"
          >
            <h2 id="delete-category-title" className="text-lg font-semibold">
              Delete {deleting.name}?
            </h2>
            <p className="text-muted-foreground text-sm">
              Its {deleting.expenseCount} {deleting.expenseCount === 1 ? "expense" : "expenses"}
              {" will remain, but become uncategorized."}
            </p>
            {deleteMutation.error && (
              <p className="text-destructive text-sm" role="alert">
                {deleteMutation.error instanceof ApiError
                  ? deleteMutation.error.message
                  : "Could not delete category"}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={deleteMutation.isPending}
                className="border-border rounded-md border px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleting.id)}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
