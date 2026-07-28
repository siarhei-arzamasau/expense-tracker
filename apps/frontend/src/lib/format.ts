/**
 * `amount` arrives from the API as a decimal string (see TransactionDto). Parsing
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
    // Transaction dates are UTC calendar days in the API. Pinning the display
    // zone prevents UTC midnight from appearing as the prior day west of UTC.
    timeZone: "UTC",
  }).format(new Date(isoDate));
}
