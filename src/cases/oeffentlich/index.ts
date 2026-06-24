/**
 * Case: "Öffentliche Projekte" (Drittmittel-/Fördervertrag).
 *
 * This is the original flow, expressed as a CaseModule. It reuses the shared
 * Drittmittel PDF document specs via a view onto ContractData, and keeps the
 * original extraction prompt and email behaviour byte-for-byte.
 */
import type { CaseModule } from '../../core/types'
import { ContractDataSchema, type ContractData } from './schema'
import {
  anzeigeDrittmittelDoc,
  erklaerungDrittmittelDoc,
  type DrittmittelView,
} from '../../shared/drittmittel_docs'
import { formatDate, formatAmount } from '../../shared/format'

const ANZEIGE_TEMPLATE = 'pdf_templates/Anzeige-DriMi_Stand-Mai-2024.pdf'
const ERKLAERUNG_TEMPLATE =
  'pdf_templates/Erklaerung-zum-Forschungs--und-Drittmittelvorhaben_Stand-November-2024.pdf'

const EXTRACTION_PROMPT = `\
You are a precise document parser for German public project contracts
(Drittmittelverträge, Förderverträge, Zuwendungsbescheide).

Extract the following fields from the contract text and return ONLY valid JSON.
Rules:
- Do not invent missing information.
- Use null for any field that cannot be found.
- Dates: use ISO 8601 format (YYYY-MM-DD) if determinable, otherwise null.
- funding_amount: numeric value only (float), no currency symbol.
- Add field names you could not find to "missing_fields".
- Add a short note about confidence or ambiguous values to "confidence_notes".

Return exactly this JSON structure, nothing else:
{
  "project_name": "string or null",
  "contract_partner": "string or null",
  "organization": "string or null",
  "address": "string or null",
  "contact_person": "string or null",
  "email": "string or null",
  "funding_amount": number or null,
  "project_start_date": "YYYY-MM-DD or null",
  "project_end_date": "YYYY-MM-DD or null",
  "contract_reference": "string or null",
  "missing_fields": ["list of field names not found"],
  "confidence_notes": "string"
}`

const EMAIL_SYSTEM_PROMPT =
  'Du bist ein Assistent für die Drittmittelverwaltung einer deutschen Hochschule. ' +
  'Erstelle einen höflichen, sachlichen Entwurf für eine interne E-Mail an den zuständigen ' +
  'Sachbearbeiter zur Anzeige eines neuen Drittmittelvorhabens. ' +
  'Halte die E-Mail kurz und professionell. Verwende förmliche Sprache (Sie-Form). ' +
  'Markiere fehlende oder unklare Informationen mit [BITTE ERGÄNZEN].'

/** Project ContractData onto the shared Drittmittel form view. */
const drittmittelView = (d: ContractData): DrittmittelView => ({
  organisation: d.organization,
  projektName: d.project_name,
  drittmittelgeber: d.contract_partner,
  anschrift: d.address,
  projektleitung: d.contact_person,
  beginn: d.project_start_date,
  ende: d.project_end_date,
  betrag: d.funding_amount,
  kennzeichen: d.contract_reference,
})

export const oeffentlichCase: CaseModule<ContractData> = {
  id: 'oeffentlich',
  displayName: 'Öffentliche Projekte (Drittmittel)',
  schema: ContractDataSchema,
  extraction: { prompt: EXTRACTION_PROMPT },
  documents: [
    anzeigeDrittmittelDoc(ANZEIGE_TEMPLATE, drittmittelView),
    erklaerungDrittmittelDoc(ERKLAERUNG_TEMPLATE, drittmittelView),
  ],
  email: {
    systemPrompt: EMAIL_SYSTEM_PROMPT,
    buildSummary: (d) =>
      [
        `Projektname:       ${d.project_name ?? '[unbekannt]'}`,
        `Drittmittelgeber:  ${d.contract_partner ?? '[unbekannt]'}`,
        `Einrichtung:       ${d.organization ?? '[unbekannt]'}`,
        `Projektleitung:    ${d.contact_person ?? '[unbekannt]'}`,
        `Fördersumme:       ${formatAmount(d.funding_amount) || '[unbekannt]'}`,
        `Laufzeit:          ${formatDate(d.project_start_date) || '[unbekannt]'} bis ${formatDate(d.project_end_date) || '[unbekannt]'}`,
        `Förderkennzeichen: ${d.contract_reference ?? '[unbekannt]'}`,
        `Fehlende Felder:   ${d.missing_fields.length > 0 ? d.missing_fields.join(', ') : 'keine'}`,
      ].join('\n'),
  },
}
