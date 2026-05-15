import { z } from 'zod'

export const ContractDataSchema = z.object({
  project_name: z.string().nullable().default(null),
  contract_partner: z.string().nullable().default(null),
  organization: z.string().nullable().default(null),
  address: z.string().nullable().default(null),
  contact_person: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  funding_amount: z.number().nullable().default(null),
  project_start_date: z.string().nullable().default(null), // ISO 8601: YYYY-MM-DD
  project_end_date: z.string().nullable().default(null),
  contract_reference: z.string().nullable().default(null),
  missing_fields: z.array(z.string()).default([]),
  confidence_notes: z.string().nullable().default(null),
})

export type ContractData = z.infer<typeof ContractDataSchema>

export function formatDate(date: string | null): string {
  if (!date) return ''
  // Split directly to avoid timezone-shift from new Date(isoString)
  const [year, month, day] = date.split('-').map(Number)
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
}

export function formatAmount(amount: number | null): string {
  if (amount === null) return ''
  return amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
