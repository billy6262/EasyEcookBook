/**
 * Formats a numeric quantity for display: rounds to 3 decimal places
 * (matching the backend's ROUND_HALF_UP behaviour) and trims trailing zeros.
 * Returns "" for null/invalid input.
 */
export function formatQuantity(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "";
  // Round to 3 decimals, then drop trailing zeros.
  const rounded = Math.round(num * 1000) / 1000;
  return String(rounded);
}

/**
 * Scales a raw quantity (string | null) by a factor and formats it for display.
 * A null/blank quantity stays blank (e.g. "to taste" ingredients).
 */
export function scaleQuantity(
  quantity: string | null | undefined,
  factor: number
): string {
  if (quantity === null || quantity === undefined || quantity === "") return "";
  const num = parseFloat(quantity);
  if (Number.isNaN(num)) return "";
  return formatQuantity(num * factor);
}
