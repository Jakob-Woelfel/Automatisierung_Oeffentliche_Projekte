import { z } from 'zod'

/**
 * Schema for the "Öffentliche Projekte" case (Drittmittel-/Fördervertrag).
 * All fields nullable with default null so a partial extraction still validates;
 * unfound fields are recorded in `missing_fields` instead of throwing.
 */
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
