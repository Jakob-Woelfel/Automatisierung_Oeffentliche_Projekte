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

const ANZEIGE_TEMPLATE = 'templates/oeffentlich/Anzeige-DriMi_Stand-Mai-2024.pdf'
const ERKLAERUNG_TEMPLATE =
  'templates/oeffentlich/Erklaerung-zum-Forschungs--und-Drittmittelvorhaben_Stand-November-2024.pdf'

const EXTRACTION_PROMPT = `\
You are a precise document parser for German public project contracts
(Drittmittelverträge, Förderverträge, Zuwendungsbescheide).

Extract the following fields from the contract text and return ONLY valid JSON.

General rules:
- Do not invent missing information.
- Use null for any field that cannot be found.
- Dates: use ISO 8601 format (YYYY-MM-DD) if determinable, otherwise null.
- funding_amount: numeric value only (float), no currency symbol.
- Add field names you could not find to "missing_fields".
- Add a short note about confidence or ambiguous values to "confidence_notes".

Rules for contact_person and organization:
- These two fields are always linked and may ONLY be filled using one of the
  exact pairs listed below.
- The document will often mention only the professor's name, OR only the
  chair/professorship title (Lehrstuhl/Professur), WITHOUT the university.
  Either one alone is sufficient to identify the pair — match on whichever
  is present:
  * If a name from the list appears (e.g. "Prof. Dr. Christoph Buck"),
    identify the pair by name, regardless of whether the organization is
    mentioned nearby.
  * If a chair/professorship title from the list appears (e.g. "Lehrstuhl
    für Wirtschaftsinformatik und Digitale Gesellschaft"), identify the pair
    by that title alone, even without "Universität Bayreuth" or any
    location following it.
  * Tolerate minor formatting differences (line breaks, punctuation,
    "Prof. Dr." vs "Prof. Dr" etc.).
- Once a pair is identified (by name or by chair title), ALWAYS output BOTH
  fields using the exact full strings from the list below — contact_person
  as the full name, and organization as the full chair title INCLUDING the
  university, even if the university was not written in the document.
- If neither a matching name nor a matching chair title can be found with
  reasonable confidence, set BOTH contact_person and organization to null
  and add both field names to "missing_fields". Never mix a name from this
  list with an organization string that is not its listed counterpart, and
  never output a contact_person/organization pair that is not on this list.

Known contact_person / organization combinations (fixed list):
1. Prof. Dr. Christoph Buck | Professur für IT-Entrepreneurship und IT-Innovationsmanagement, Technische Hochschule Augsburg
2. Prof. Dr. Torsten Eymann | Lehrstuhl für Wirtschaftsinformatik und Digitale Gesellschaft, Universität Bayreuth
3. Prof. Dr. Henner Gimpel | Lehrstuhl für Digitales Management, Universität Hohenheim
4. Prof. Dr. Björn Häckel | Professur für Digitale Wertschöpfungsnetze, Technische Hochschule Augsburg
5. Prof. Dr. Wolfgang Kratsch | Professur für Angewandte KI in der Digitalen Wertschöpfung, Technische Hochschule Augsburg
6. Prof. Dr. Niklas Kühl | Lehrstuhl für Wirtschaftsinformatik und humanzentrische Künstliche Intelligenz, Universität Bayreuth
7. Prof. Dr. Anna Maria Oberländer | Juniorprofessur für Wirtschaftsinformatik und Digitale Transformation, Universität Bayreuth
8. Prof. Dr. Maximilian Röglinger | Lehrstuhl für Wirtschaftsinformatik und Wertorientiertes Prozessmanagement, Universität Bayreuth
9. Prof. Dr. Manfred Schoch | Inhaber der Professur für Wirtschaftsinformatik, Hochschule Esslingen
10. Prof. Dr. Jens Strüker | Professur für Wirtschaftsinformatik und Digitales Energiemanagement, Universität Bayreuth
11. Prof. Dr. Nils Urbach | Professur für Wirtschaftsinformatik, insb. Digital Business und Mobilität, Frankfurt University of Applied Sciences

Rules for address:
- The "address" field refers ONLY to the contract_partner's address (the
  external funding body / Zuwendungsgeber / Auftraggeber) — NEVER the
  address of the university/Hochschule side (contact_person's institution).
- Documents often list two addresses (Empfänger and Sender, or recipient
  and issuer) and these are easy to mix up. To decide correctly:
  * Any address containing or clearly belonging to one of the universities
    listed in the contact_person/organization list above (Technische
    Hochschule Augsburg, Universität Bayreuth, Universität Hohenheim,
    Hochschule Esslingen, Frankfurt University of Applied Sciences, or the
    university you identified as "organization") is NEVER the value for
    "address" — exclude it, even if it appears first, in a letterhead, or
    as the "recipient" in the document layout.
  * The correct "address" is the OTHER address in the document — i.e. the
    one belonging to the contract_partner / funding organization, not to
    the university.
  * If only one address appears in the document and it belongs to the
    university, set "address" to null rather than using the university's
    address.
  * If you cannot confidently determine which of two addresses belongs to
    the contract_partner, set "address" to null and note the ambiguity in
    "confidence_notes".

Return exactly this JSON structure, nothing else:
{
  "project_name": "string or null",
  "contract_partner": "string or null",
  "organization": "string or null",
  "contact_person": "string or null",
  "address": "string or null",
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
  // contact_person is only ever one of the fixed professors above or null
  // (enforced by EXTRACTION_PROMPT), so "not null" means "is a known Lehrstuhlinhaber".
  projektleitungIstLehrstuhlinhaber: d.contact_person !== null,
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
