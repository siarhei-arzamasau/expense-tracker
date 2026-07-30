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
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Dialog } from "radix-ui";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
  const pickerId = `category-icon-picker-${category?.id ?? "new"}`;
  const nameId = `category-name-${category?.id ?? "new"}`;
  const nameErrorId = `${nameId}-error`;
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
      className="bg-secondary/60 space-y-5 rounded-2xl p-5"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div className="space-y-2">
        <label htmlFor={nameId} className="block text-[0.8125rem] font-semibold">
          Name
        </label>
        {/* `aria-describedby` and `role="alert"` are what make this message
            exist for a screen reader. react-hook-form moves focus to the first
            invalid field on submit, but focus alone announces the name and
            nothing else — without the association a reader was told "Name, edit
            text" and never why the form refused to submit (SC 3.3.1), and the
            message appearing announced nothing at all (SC 4.1.3). */}
        <input
          id={nameId}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? nameErrorId : undefined}
          className="bg-background border-input placeholder:text-muted-foreground focus-visible:ring-ring/70 aria-invalid:border-destructive h-10 w-full rounded-full border px-4 text-sm transition-[border-color,box-shadow] outline-none focus-visible:ring-[3px]"
          placeholder="Groceries, Rent, Salary…"
          {...register("name")}
        />
        {errors.name && (
          <p id={nameErrorId} role="alert" className="text-destructive text-[0.8125rem]">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <span className="block text-[0.8125rem] font-semibold">Color</span>
          <div className="flex items-center gap-2">
            <input
              aria-label="Category color"
              type="color"
              value={color ?? "#64748b"}
              onChange={(event) => setValue("color", event.target.value, { shouldDirty: true })}
              className="bg-background size-10 shrink-0 cursor-pointer rounded-full border-4 border-white p-0.5 shadow-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setValue("color", null, { shouldDirty: true })}
              className="bg-background"
            >
              No color
            </Button>
            {color === null && <span className="text-muted-foreground text-xs">None</span>}
          </div>
        </div>

        <div className="space-y-2">
          <span className="block text-[0.8125rem] font-semibold">Icon</span>
          <div className="flex items-center gap-2">
            {/* The visible content is an emoji (or a bare "＋"), which is the
                whole accessible name without an explicit one — so the button
                announces as "＋" or as the emoji itself. `aria-controls` is set
                only while open, because the picker is unmounted when closed and
                pointing at an absent id is worse than omitting the attribute. */}
            <button
              type="button"
              aria-expanded={pickerOpen}
              aria-controls={pickerOpen ? pickerId : undefined}
              aria-label={icon ? `Change icon, currently ${icon}` : "Choose an icon"}
              onClick={() => setPickerOpen((open) => !open)}
              className="bg-background focus-visible:ring-ring/70 flex size-10 shrink-0 items-center justify-center rounded-full text-lg shadow-sm transition-transform outline-none hover:scale-105 focus-visible:ring-[3px]"
            >
              <span aria-hidden>{icon ?? "＋"}</span>
            </button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="bg-background"
              onClick={() => {
                setValue("icon", null, { shouldDirty: true });
                setPickerOpen(false);
              }}
            >
              Remove icon
            </Button>
          </div>
        </div>
      </div>

      {pickerOpen && (
        // `emoji-picker-host` carries the contrast override in `globals.css`;
        // the library's own stylesheet is injected at runtime and would win a
        // tie on cascade order, so the override needs the extra ancestor.
        <div id={pickerId} className="emoji-picker-host max-w-full overflow-hidden rounded-2xl">
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
        <p className="text-destructive text-[0.8125rem]" role="alert">
          {error instanceof ApiError ? error.message : "Could not save category"}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : category ? "Save changes" : "Add category"}
        </Button>
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
  /**
   * Which row opened the delete dialog. Radix returns focus to its
   * `Dialog.Trigger` on close, but this dialog is shared by every row and opened
   * from state rather than from a trigger, so there is nothing for it to return
   * to — focus lands on `<body>` and the reader loses their place in the list.
   * Holding the button here is what makes `onCloseAutoFocus` able to put it back.
   */
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  /** Where focus goes when that button no longer exists — see `onCloseAutoFocus`. */
  const listHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const { data: categories, isPending, error } = useQuery(categoriesQueryOptions);

  const invalidateCategoryData = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
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
    <main className="px-5 py-7 sm:px-7 lg:px-9 lg:py-9">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Labels</p>
          <h1 className="mt-2 text-[1.75rem] leading-none font-bold">Categories</h1>
          <p className="text-muted-foreground mt-2.5 text-sm">
            Organize transactions with a name, color, and emoji.
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/transactions">View transactions</Link>
        </Button>
      </header>

      <section aria-labelledby="add-category-heading" className="mb-9 max-w-2xl space-y-4">
        <h2 id="add-category-heading" className="text-xl font-semibold">
          Add category
        </h2>
        <CategoryForm
          key={newFormKey}
          error={createMutation.error}
          isPending={createMutation.isPending}
          onSubmit={handleCreate}
        />
      </section>

      <section aria-labelledby="category-list-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {/* `tabIndex={-1}` so the delete dialog can hand focus back here
                when the row it was opened from no longer exists. Not reachable
                by Tab; only programmatically. */}
            <h2
              id="category-list-heading"
              ref={listHeadingRef}
              tabIndex={-1}
              className="text-xl font-semibold focus:outline-none"
            >
              Your categories
            </h2>
            {categories && (
              <p className="text-muted-foreground mt-1 text-sm">{categories.length} total</p>
            )}
          </div>
          <label className="space-y-2 text-[0.8125rem] font-semibold">
            <span className="block">Search</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name"
              className="bg-secondary border-input placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-ring/70 h-10 w-56 rounded-full border px-4 text-sm font-normal transition-[background-color,border-color,box-shadow] outline-none focus-visible:ring-[3px]"
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
          <div className="bg-secondary/60 rounded-2xl px-6 py-14 text-center">
            <p className="text-muted-foreground text-sm">
              {search ? "No categories match your search." : "No categories yet."}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {filteredCategories.map((category) => (
            <div key={category.id} className="space-y-3">
              <div
                data-slot="category-row"
                className="bg-secondary/60 flex flex-wrap items-center gap-4 rounded-2xl p-4"
              >
                <span
                  aria-hidden
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-xl"
                  style={{ backgroundColor: category.color ?? "var(--muted)" }}
                >
                  {category.icon ?? "•"}
                </span>
                {/* basis-28 is what makes the wrap land on the buttons rather than
                    on this column: without it the row keeps every child on one
                    line and squeezes the text to ~86px, which splits "2
                    transactions" across two lines at 390px. */}
                <div className="min-w-0 flex-1 basis-28">
                  <p className="truncate font-semibold">{category.name}</p>
                  <p className="text-muted-foreground mt-0.5 text-[0.8125rem]">
                    {category.transactionCount}{" "}
                    {category.transactionCount === 1 ? "transaction" : "transactions"}
                  </p>
                </div>
                <div className="ml-auto flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="bg-background"
                    onClick={() => setEditing(category)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="hover:text-destructive"
                    onClick={(event) => {
                      // Clear any failure left from a previous attempt, or the
                      // dialog opens already showing an error about a category
                      // the reader is no longer looking at.
                      deleteMutation.reset();
                      deleteTriggerRef.current = event.currentTarget;
                      setDeleting(category);
                    }}
                  >
                    Delete
                  </Button>
                </div>
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

      {/* Radix rather than a hand-rolled overlay: `role="dialog"` plus
          `aria-modal` is a promise about behaviour, not a label. The previous
          version made that promise and kept none of it — focus never entered the
          dialog, Tab walked straight back out into the page that `aria-modal`
          had just told assistive tech to ignore, Escape did nothing and focus
          was never restored. Dialog.Root supplies all of it. */}
      <Dialog.Root
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px]" />
          <Dialog.Content
            // No `id` here: Radix generates one and points the trigger's
            // `aria-controls` at it, and it spreads caller props last.
            className="bg-background rounded-panel shadow-panel fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 p-7 focus:outline-none"
            // A delete in flight should not be dismissable out from under the
            // request; the buttons are already disabled for the same reason.
            onEscapeKeyDown={(event) => {
              if (deleteMutation.isPending) event.preventDefault();
            }}
            onInteractOutside={(event) => {
              if (deleteMutation.isPending) event.preventDefault();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              // On cancel the row survives and its button takes focus back. On a
              // successful delete it does not: `onSuccess` awaits the
              // invalidation, so the collection has already refetched without
              // this category and the held button is detached by the time we get
              // here — and `focus()` on a detached node is a silent no-op that
              // drops the reader on `<body>`. The heading is the nearest thing
              // still on screen.
              const trigger = deleteTriggerRef.current;
              if (trigger?.isConnected) {
                trigger.focus();
              } else {
                listHeadingRef.current?.focus();
              }
            }}
          >
            {deleting && (
              <>
                <Dialog.Title className="text-xl font-semibold">
                  Delete {deleting.name}?
                </Dialog.Title>
                <Dialog.Description className="text-muted-foreground text-sm">
                  {deleting.transactionCount > 0
                    ? `This category has ${deleting.transactionCount} ${deleting.transactionCount === 1 ? "transaction" : "transactions"} and cannot be deleted until they are recategorized or removed.`
                    : "This category has no transactions and can be safely deleted."}
                </Dialog.Description>
                {deleteMutation.error && (
                  <p className="text-destructive text-[0.8125rem]" role="alert">
                    {deleteMutation.error instanceof ApiError
                      ? deleteMutation.error.message
                      : "Could not delete category"}
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Dialog.Close asChild>
                    <Button type="button" variant="ghost" disabled={deleteMutation.isPending}>
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(deleting.id)}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? "Deleting…" : "Delete category"}
                  </Button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
