"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// `type` is deliberately not accepted: this component owns it, and a caller
// passing type="password" would pin the field shut. Everything else — the id,
// aria-describedby and aria-invalid that FormControl clones onto its child,
// plus react-hook-form's value/onChange/ref — is forwarded to the real input,
// so the label's htmlFor still resolves to a focusable form control.
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = React.useState(false);
  const Icon = visible ? EyeOffIcon : EyeIcon;

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-9", className)} {...props} />
      {/* The accessible name names the action and changes with state; no
          aria-pressed alongside it, since a toggle that flips both its label
          and its pressed state is announced twice and reads as contradictory. */}
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        disabled={props.disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export { PasswordInput };
