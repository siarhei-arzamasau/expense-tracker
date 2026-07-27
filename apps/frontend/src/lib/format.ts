/**
 * `amount` arrives from the API as a decimal string (see ExpenseDto). Parsing
 * happens here, at the display boundary, and nowhere else.
 */
export function formatAmount(amount: string, currency = "USD"): string {
  const value = Number(amount);
  if (Number.isNaN(value)) {
    return amount;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

/** Sums decimal strings in integer cents to avoid float drift. */
export function sumAmounts(amounts: string[]): string {
  const cents = amounts.reduce((total, amount) => total + Math.round(Number(amount) * 100), 0);
  return (cents / 100).toFixed(2);
}
