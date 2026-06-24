/**
 * Shared, case-agnostic formatting helpers.
 *
 * Used by field mappings, email summaries and any document renderer.
 * Keep formatting logic here so cases stay declarative.
 */

/** ISO 8601 (YYYY-MM-DD) → German DD.MM.YYYY. Empty string for null/empty. */
export function formatDate(date: string | null): string {
  if (!date) return ''
  // Split directly to avoid timezone-shift from new Date(isoString)
  const [year, month, day] = date.split('-').map(Number)
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
}

/** Number → German currency string "1.234,56 €". Empty string for null. */
export function formatAmount(amount: number | null): string {
  if (amount === null) return ''
  return amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

/** Today as German DD.MM.YYYY. */
export function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`
}
