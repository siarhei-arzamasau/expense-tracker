import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Filled rather than outlined at rest, and pill-shaped like every other
 * control. The border only appears on focus, which is what keeps a form of six
 * fields from reading as six boxes.
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
        "bg-secondary placeholder:text-muted-foreground/80 selection:bg-primary selection:text-primary-foreground h-10 w-full min-w-0 rounded-full border border-transparent px-4 py-1 text-base transition-[color,background-color,border-color,box-shadow] outline-none md:text-sm",
        "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
        "focus-visible:border-input focus-visible:bg-background focus-visible:ring-ring/15 focus-visible:ring-[3px]",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/15 aria-invalid:ring-[3px]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
