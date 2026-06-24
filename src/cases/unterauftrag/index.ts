/**
 * Case: "Unterauftrag" (UBT wissenschaftliche Dienstleistung / subcontract).
 *
 * Demonstrates the modular architecture end-to-end:
 *   - REUSES the shared Anzeige/Erklärung Drittmittel PDF docs via a view
 *   - ADDS a case-specific steuerliche-Behandlung PDF (pdf-form)
 *   - ADDS a case-specific Kalkulations-Excel (excel-patch) fed by calc.ts
 *   - ADDS an email addressed to the UBT-Vertragsteam
 *   - nests outputs in a PR-Nummer subfolder
 *
 * SCAFFOLD: extraction prompt, PT-Satz and the exact Excel input cells beyond
 * the two confirmed ones (I21, H35) still need real values — see TODOs.
 */
import type { CaseModule, CellEdit, DocumentSpec } from '../../core/types'
import { UnterauftragDataSchema, type UnterauftragData } from './schema'
import { calcUnterauftrag, type UnterauftragCalc } from './calc'
import {
  anzeigeDrittmittelDoc,
  erklaerungDrittmittelDoc,
  type DrittmittelView,
} from '../../shared/drittmittel_docs'
import { formatDate, formatAmount, today } from '../../shared/format'

const ANZEIGE_TEMPLATE = 'pdf_templates/Anzeige-DriMi_Stand-Mai-2024.pdf'
const ERKLAERUNG_TEMPLATE =
  'pdf_templates/Erklaerung-zum-Forschungs--und-Drittmittelvorhaben_Stand-November-2024.pdf'
const STEUERLICHE_TEMPLATE = 'pdf_templates/Erklaerung-zur-steuerlichen-Behandlung_Stand-November-2023.pdf'
const KALKULATION_TEMPLATE =
  'xlsx_templates/Wissenschaftliche-Dienstleistung-Kalkulationsunterlagen-ab-01_02_2025_Stand-April-2025.xlsm'

// SCAFFOLD prompt — tune against real anonymised Fraunhofer subcontracts.
const EXTRACTION_PROMPT = `\
Du bist ein präziser Dokument-Parser für Fraunhofer-Unterauftrags-/Werkverträge
über wissenschaftliche Dienstleistungen an eine deutsche Hochschule.

Extrahiere die folgenden Felder aus dem Vertragstext und gib NUR gültiges JSON zurück.
Regeln:
- Erfinde keine Informationen. Verwende null, wenn ein Feld nicht auffindbar ist.
- Datumsangaben im ISO-Format (YYYY-MM-DD), sonst null.
- gesamtnetto: nur die Netto-Zahl (Auftragswert/Gesamtnettosumme), ohne Währungszeichen.
- projekttage: Anzahl der Personentage (PT) als Zahl, falls angegeben.
- partnerland: "inland", "eu" oder "drittland" je nach Sitz des Auftraggebers, sonst null.
- Nicht gefundene Felder in "missing_fields" auflisten.

Gib exakt diese JSON-Struktur zurück, nichts anderes:
{
  "pr_nummer": "string oder null",
  "projekttitel": "string oder null",
  "auftraggeber": "string oder null",
  "auftraggeber_anschrift": "string oder null",
  "auftragsnummer": "string oder null",
  "gesamtnetto": number oder null,
  "projekttage": number oder null,
  "laufzeit_beginn": "YYYY-MM-DD oder null",
  "laufzeit_ende": "YYYY-MM-DD oder null",
  "leistungsbeschreibung": "string oder null",
  "lehrstuhl_einrichtung": "string oder null",
  "ansprechpartner": "string oder null",
  "partnerland": "inland | eu | drittland | null",
  "vat_nummer": "string oder null",
  "missing_fields": ["Liste nicht gefundener Felder"],
  "confidence_notes": "string"
}`

const EMAIL_SYSTEM_PROMPT =
  'Du bist ein Assistent für die Drittmittelverwaltung einer deutschen Hochschule. ' +
  'Erstelle einen höflichen, sachlichen Entwurf für eine E-Mail an das UBT-Vertragsteam ' +
  'zur Einreichung eines Unterauftrags (wissenschaftliche Dienstleistung). ' +
  'Weise darauf hin, dass die ausgefüllten Formulare und die Kalkulation beigefügt sind und ' +
  'per Hauspost im Original mit Unterschrift bzw. via DocuSign nachgereicht werden. ' +
  'Kurz, professionell, Sie-Form. Markiere fehlende Angaben mit [BITTE ERGÄNZEN].'

/** Project UnterauftragData onto the shared Drittmittel form view. */
const drittmittelView = (d: UnterauftragData): DrittmittelView => ({
  organisation: d.lehrstuhl_einrichtung,
  projektName: d.projekttitel,
  drittmittelgeber: d.auftraggeber,
  anschrift: d.auftraggeber_anschrift,
  projektleitung: d.ansprechpartner,
  beginn: d.laufzeit_beginn,
  ende: d.laufzeit_ende,
  betrag: d.gesamtnetto,
  kennzeichen: d.auftragsnummer ?? d.pr_nummer,
})

/** Case-specific PDF: Erklärung zur steuerlichen Behandlung. */
const steuerlicheBehandlungDoc: DocumentSpec<UnterauftragData> = {
  kind: 'pdf-form',
  name: 'steuerliche_behandlung',
  template: STEUERLICHE_TEMPLATE,
  mapping: {
    LehrstuhlEinrichtung: (d) => d.lehrstuhl_einrichtung ?? '',
    'Projekt-/Tätigkeitsbezeichnung_1': (d) => d.projekttitel ?? '',
    'VAT-Nummer/Partner': (d) => d.vat_nummer ?? '',
    'Lehrstuhlinhaber_in/Projektverantwortliche_r in Druckbuchstaben': (d) => d.ansprechpartner ?? '',
    'Datum Unterschrift_af_date': () => today(),
  },
  checkboxes: {
    // This case is always a wissenschaftliche Dienstleistung.
    'eine wissenschaftliche Dienstleistung handelt': true,
    // Steuerliche Ansässigkeit des Partners.
    'Inland ansässig': (d) => d.partnerland === 'inland',
    'EULand ansässig': (d) => d.partnerland === 'eu',
    'Nicht EULand ansässig': (d) => d.partnerland === 'drittland',
  },
}

/** Case-specific Excel: UBT Kalkulationsunterlagen (only a few cells). */
const kalkulationDoc: DocumentSpec<UnterauftragData> = {
  kind: 'excel-patch',
  name: 'kalkulation',
  template: KALKULATION_TEMPLATE,
  cells: (_d, derived): CellEdit[] => {
    const c = derived as unknown as UnterauftragCalc
    return [
      // Personalkosten: Tarifstufe-Zeile "A13", Stundenanzahl (= PT × 10) in I21.
      { sheet: 'Personalkosten', ref: 'I21', value: c.stunden },
      // Gesamtkalkulation: H35 so setzen, dass die Gesamt-Nettosumme der
      // Projektsumme entspricht. TODO(verify): an echtem Muster prüfen, ob das
      // Schreiben von gesamtnetto in H35 allein die Gesamt-Nettosumme trifft.
      { sheet: 'Gesamtkalkulation', ref: 'H35', value: c.gesamtnetto },
      // TODO(verify): wenige grüne Eingabezellen in "Daten zum Auftrag"
      // (Auftraggeber, Projektbezeichnung, Lehrstuhl) — exakte Zelladressen
      // noch zu bestätigen; bewusst ausgelassen, um keine falschen Zellen zu füllen.
    ]
  },
}

export const unterauftragCase: CaseModule<UnterauftragData> = {
  id: 'unterauftrag',
  displayName: 'Unterauftrag (wiss. Dienstleistung)',
  schema: UnterauftragDataSchema,
  extraction: { prompt: EXTRACTION_PROMPT },
  derive: (d) => ({ ...calcUnterauftrag(d) }),
  outputSubdir: (d) => d.pr_nummer,
  documents: [
    anzeigeDrittmittelDoc(ANZEIGE_TEMPLATE, drittmittelView),
    erklaerungDrittmittelDoc(ERKLAERUNG_TEMPLATE, drittmittelView),
    steuerlicheBehandlungDoc,
    kalkulationDoc,
  ],
  email: {
    systemPrompt: EMAIL_SYSTEM_PROMPT,
    recipient: 'UBT-Vertragsteam', // TODO(user): konkrete Zieladresse einsetzen
    subject: 'Unterauftrag – wissenschaftliche Dienstleistung',
    buildSummary: (d) =>
      [
        `PR-Nummer:         ${d.pr_nummer ?? '[unbekannt]'}`,
        `Projekttitel:      ${d.projekttitel ?? '[unbekannt]'}`,
        `Auftraggeber:      ${d.auftraggeber ?? '[unbekannt]'}`,
        `Auftragsnummer:    ${d.auftragsnummer ?? '[unbekannt]'}`,
        `Auftragswert netto:${formatAmount(d.gesamtnetto) || ' [unbekannt]'}`,
        `Personentage (PT): ${d.projekttage ?? '[unbekannt]'}`,
        `Laufzeit:          ${formatDate(d.laufzeit_beginn) || '[unbekannt]'} bis ${formatDate(d.laufzeit_ende) || '[unbekannt]'}`,
        `Einrichtung:       ${d.lehrstuhl_einrichtung ?? '[unbekannt]'}`,
        `Fehlende Felder:   ${d.missing_fields.length > 0 ? d.missing_fields.join(', ') : 'keine'}`,
      ].join('\n'),
  },
}
