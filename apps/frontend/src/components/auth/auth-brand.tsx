import { WalletCards } from "lucide-react";

/**
 * The lockup above every signed-out card. It is the page's `h1`: the cards
 * below it hold a form, not a second title, and repeating "Expense Tracker"
 * inside them only made the heading order harder to read.
 */
export function AuthBrand({ tagline }: { tagline: string }) {
  return (
    <div className="mb-7 px-1">
      <h1 className="font-display flex items-center gap-2.5 text-[1.375rem] leading-none font-bold tracking-tight">
        <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl">
          <WalletCards aria-hidden className="size-5" strokeWidth={1.75} />
        </span>
        Expense Tracker
      </h1>
      <p className="text-muted-foreground mt-3 text-sm">{tagline}</p>
    </div>
  );
}
