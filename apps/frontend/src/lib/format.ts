/**
 * Building an `Intl` formatter is the expensive half of formatting; `.format()`
 * is cheap. These are held rather than constructed per call because the
 * transaction list renders the same page twice — the desktop table and the
 * mobile list — so one render formatted every row's amount and date twice over,
 * and each of those calls was building a formatter it then threw away.
 *
 * Keyed by currency, because `formatAmount` accepts one.
 */
const amountFormatters = new Map<string, Intl.NumberFormat>();

function amountFormatter(currency: string): Intl.NumberFormat {
  let formatter = amountFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", { style: "currency", currency });
    amountFormatters.set(currency, formatter);
  }
  return formatter;
}

/**
 * `amount` arrives from the API as a decimal string (see TransactionDto). Parsing
 * happens here, at the display boundary, and nowhere else.
 */
export function formatAmount(amount: string, currency = "USD"): string {
  const value = Number(amount);
  if (Number.isNaN(value)) {
    return amount;
  }
  return amountFormatter(currency).format(value);
}

/**
 * How the month's money splits between what came in and what went out, as two
 * fractions of the total moved. The dashboard draws its summary bars from this.
 *
 * Arithmetic on `amount` lives here for the same reason parsing does: these are
 * decimal strings, and a ratio computed anywhere else in the app is a `Number()`
 * call somebody has to remember not to reuse for money. Nothing here produces a
 * figure that is shown as currency — only widths and percentages.
 *
 * Both shares are 0 when the month is empty or either value will not parse,
 * which the caller renders as "no activity" rather than as a zero-width bar.
 */
export function flowShares(income: string, expense: string): { income: number; expense: number } {
  const inValue = Math.abs(Number(income));
  const outValue = Math.abs(Number(expense));
  const moved = inValue + outValue;

  if (!Number.isFinite(moved) || moved === 0) {
    return { income: 0, expense: 0 };
  }

  return { income: inValue / moved, expense: outValue / moved };
}

/** A share as whole percent, for captions. `0.5824` → `"58%"`. */
export function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  // Transaction dates are UTC calendar days in the API. Pinning the display
  // zone prevents UTC midnight from appearing as the prior day west of UTC.
  timeZone: "UTC",
});

export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate));
}
