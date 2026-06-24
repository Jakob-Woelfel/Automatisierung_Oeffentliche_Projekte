import { z } from 'zod'

/**
 * Schema for the "Unterauftrag" case (UBT wissenschaftliche Dienstleistung /
 * subcontract, e.g. commissioned by a Fraunhofer institute).
 *
 * Only three values actually drive calculation: `projekttage` (PT) and
 * `gesamtnetto` come from the contract; the PT-Satz is a fixed config constant
 * (see calc.ts). The remaining fields populate the reused Drittmittel forms and
 * the steuerliche-Behandlung form. All nullable so partial extractions validate.
 */
export const UnterauftragDataSchema = z.object({
  pr_nummer: z.string().nullable().default(null),
  projekttitel: z.string().nullable().default(null),
  /** Auftraggeber / beauftragendes Institut (z. B. Fraunhofer-Institut). */
  auftraggeber: z.string().nullable().default(null),
  auftraggeber_anschrift: z.string().nullable().default(null),
  auftragsnummer: z.string().nullable().default(null),
  /** Auftragswert netto / Gesamtnettosumme in EUR (numeric, no symbol). */
  gesamtnetto: z.number().nullable().default(null),
  /** Personentage (PT) gesamt. 1 PT = 10 Stunden. */
  projekttage: z.number().nullable().default(null),
  laufzeit_beginn: z.string().nullable().default(null), // ISO 8601 YYYY-MM-DD
  laufzeit_ende: z.string().nullable().default(null),
  leistungsbeschreibung: z.string().nullable().default(null),
  lehrstuhl_einrichtung: z.string().nullable().default(null),
  /** Projektverantwortliche/r am Lehrstuhl. */
  ansprechpartner: z.string().nullable().default(null),
  /** Steuerliche Ansässigkeit des Partners — steuert USt-/Ankreuzlogik. */
  partnerland: z.enum(['inland', 'eu', 'drittland']).nullable().default(null),
  /** USt-IdNr. / VAT-Nummer des Partners (bei EU/Drittland). */
  vat_nummer: z.string().nullable().default(null),
  missing_fields: z.array(z.string()).default([]),
  confidence_notes: z.string().nullable().default(null),
})

export type UnterauftragData = z.infer<typeof UnterauftragDataSchema>
