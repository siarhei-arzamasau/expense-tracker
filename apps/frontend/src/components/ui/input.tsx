import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Filled rather than outlined, and pill-shaped like every other control. The
 * fill is what carries the look — six outlined boxes in a row is what this
 * replaced — but it cannot be the only thing that says "this is a field":
 * `bg-secondary` on a white card measures 1.11:1, so an empty input had no
 * perceivable boundary. `border-input` is the SC 1.4.11 edge and is present at
 * rest, not only on focus; see `--input` in `globals.css` for the ratios.
 *
 * `md:text-sm` over a 16px base is deliberate: iOS Safari zooms the viewport on
 * focus for anything smaller.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "bg-secondary border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground h-10 w-full min-w-0 rounded-full border px-4 py-1 text-base transition-[color,background-color,border-color,box-shadow] outline-none md:text-sm",
        "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
        "focus-visible:bg-background focus-visible:ring-ring/70 focus-visible:ring-[3px]",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/15 aria-invalid:ring-[3px]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
