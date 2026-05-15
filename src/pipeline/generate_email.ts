import OpenAI from 'openai'
import * as dotenv from 'dotenv'
import type { ContractData } from '../schema/contract_schema'
import { formatDate, formatAmount } from '../schema/contract_schema'

dotenv.config()

// ── Configuration — edit these to change email behavior ───────────────────────
const MODEL = 'gpt-4o-mini'

const EMAIL_SYSTEM_PROMPT =
  'Du bist ein Assistent für die Drittmittelverwaltung einer deutschen Hochschule. ' +
  'Erstelle einen höflichen, sachlichen Entwurf für eine interne E-Mail an den zuständigen ' +
  'Sachbearbeiter zur Anzeige eines neuen Drittmittelvorhabens. ' +
  'Halte die E-Mail kurz und professionell. Verwende förmliche Sprache (Sie-Form). ' +
  'Markiere fehlende oder unklare Informationen mit [BITTE ERGÄNZEN].'
// ─────────────────────────────────────────────────────────────────────────────

export async function generateEmailDraft(data: ContractData): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const projectSummary = [
    `Projektname:       ${data.project_name ?? '[unbekannt]'}`,
    `Drittmittelgeber:  ${data.contract_partner ?? '[unbekannt]'}`,
    `Einrichtung:       ${data.organization ?? '[unbekannt]'}`,
    `Projektleitung:    ${data.contact_person ?? '[unbekannt]'}`,
    `Fördersumme:       ${formatAmount(data.funding_amount) || '[unbekannt]'}`,
    `Laufzeit:          ${formatDate(data.project_start_date) || '[unbekannt]'} bis ${formatDate(data.project_end_date) || '[unbekannt]'}`,
    `Förderkennzeichen: ${data.contract_reference ?? '[unbekannt]'}`,
    `Fehlende Felder:   ${data.missing_fields.length > 0 ? data.missing_fields.join(', ') : 'keine'}`,
  ].join('\n')

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: EMAIL_SYSTEM_PROMPT },
      { role: 'user', content: `Erstelle die E-Mail auf Basis dieser Projektdaten:\n\n${projectSummary}` },
    ],
    temperature: 0.3,
  })

  return response.choices[0].message.content!
}
