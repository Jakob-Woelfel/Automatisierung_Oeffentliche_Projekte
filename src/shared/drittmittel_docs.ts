/**
 * Reusable document specs for the two Drittmittel PDF forms shared across cases:
 *   - Anzeige zur Annahme eingeworbener privater Drittmittel
 *   - Erklärung zum Forschungs- und Drittmittelvorhaben 
 *
 * These forms are case-agnostic. A case adapts its own data shape to the common
 * `DrittmittelView` and gets the field mapping for free — this is the concrete
 * reuse point of the modular architecture. To use a different blank template,
 * pass its path; field names are stable across the shared templates.
 */
import type { DocumentSpec } from '../core/types'
import { formatDate, formatAmount, today } from './format'

/** The common projection both cases provide for the Drittmittel forms. */
export interface DrittmittelView {
  /** Lehrstuhl / Einrichtung */
  organisation: string | null
  /** Projekt- / Vorhabensbezeichnung */
  projektName: string | null
  /** Drittmittelgeber / Zuwendungsgeber / Auftraggeber */
  drittmittelgeber: string | null
  /** Anschrift des Gebers */
  anschrift: string | null
  /** Projektleitung */
  projektleitung: string | null
  /** Laufzeitbeginn (ISO YYYY-MM-DD) */
  beginn: string | null
  /** Laufzeitende (ISO YYYY-MM-DD) */
  ende: string | null
  /** Betrag / Fördersumme / Auftragswert (netto) */
  betrag: number | null
  /** Förderkennzeichen / Vertrags-/Auftragsnummer */
  kennzeichen: string | null
  /** True if `projektleitung` is a known Lehrstuhlinhaber (not just any contact). */
  projektleitungIstLehrstuhlinhaber?: boolean
}

/**
 * Splits a string at the given absolute cutoff positions, mirroring the
 * original PyMuPDF field-splitting behaviour (e.g. text[:35], text[35:95], text[95:]).
 * `splitText(s, 35)` → [s[0:35], s[35:]]
 * `splitText(s, 35, 95)` → [s[0:35], s[35:95], s[95:]]
 */
function splitText(text: string | null | undefined, ...limits: number[]): string[] {
  const s = text ?? ''
  const parts: string[] = []
  let start = 0
  for (const limit of limits) {
    parts.push(s.slice(start, limit))
    start = limit
  }
  parts.push(s.slice(start))
  return parts
}

/**
 * Combines Drittmittelgeber + Anschrift, mirroring _get_combined_partner_info().
 * Omits the name if it is already contained in the address, to avoid duplication.
 */
function combinedPartnerInfo(v: DrittmittelView): string {
  const { drittmittelgeber: name, anschrift: address } = v
  const nameAlreadyInAddress = !!name && !!address && address.toLowerCase().includes(name.toLowerCase())
  return [nameAlreadyInAddress ? null : name, address].filter(Boolean).join('\n')
}

/** DocumentSpec for the "Anzeige-DriMi" PDF. */
export function anzeigeDrittmittelDoc<T>(
  template: string,
  view: (d: T) => DrittmittelView,
  name = 'anzeige_drimi'
): DocumentSpec<T> {
  return {
    kind: 'pdf-form',
    name,
    template,
    mapping: {
      Datum: () => today(),
      LehrstuhlEinrichtung: (d) => view(d).organisation ?? '',
      Projektleitung: (d) => view(d).projektleitung ?? '',

      // --- Split für Bezeichnung des Vorhabens (Projektname), Schnitt bei 35 ---
      'Bezeichnung des Vorhabens_1': (d) => splitText(view(d).projektName, 35)[0],
      'Bezeichnung des Vorhabens_2': (d) => splitText(view(d).projektName, 35)[1],

      // --- Split für Name und Anschrift des Drittmittelgebers, Schnitt bei 60 ---
      'Name und Anschrift des Drittmittelgebers 1': (d) =>
        splitText(combinedPartnerInfo(view(d)), 60)[0],
      'Name und Anschrift des Drittmittelgebers_2': (d) =>
        splitText(combinedPartnerInfo(view(d)), 60)[1],

      'Beginn - Laufzeit des Vorhabens': (d) => formatDate(view(d).beginn),
      'Ende - Laufzeit des Vorhabens': (d) => formatDate(view(d).ende),
      'Höhe und Zweckbestimmung der Mittel_1': (d) => formatAmount(view(d).betrag),
      'Name in Druckbuchstaben': (d) => view(d).projektleitung ?? '',
    },
  }
}

/** DocumentSpec for the "Erklärung zum Forschungs- und Drittmittelvorhaben" PDF. */
export function erklaerungDrittmittelDoc<T>(
  template: string,
  view: (d: T) => DrittmittelView,
  name = 'erklaerung'
): DocumentSpec<T> {
  return {
    kind: 'pdf-form',
    name,
    template,
    mapping: {
      Datum: () => today(),
      LehrstuhlEinrichtung: (d) => view(d).organisation ?? '',
      'Name der Projektleitung': (d) => view(d).projektleitung ?? '',

      // --- Split für Zuwendungsgeber, Schnitt bei 25 ---
      Zuwendungssgeber: (d) => splitText(view(d).drittmittelgeber, 25)[0],
      'Zuwendungssgeber 2': (d) => splitText(view(d).drittmittelgeber, 25)[1],

      'ggf Datum  Förderkennzeichen': (d) => view(d).kennzeichen ?? '',
      'FuEVertrag Datum': (d) => formatDate(view(d).beginn),

      // --- Split für Bezeichnung des Vorhabens, Schnitte bei 35 und 95 ---
      'Bezeichnung des Vorhabens 1': (d) => splitText(view(d).projektName, 35, 95)[0],
      'Bezeichnung des Vorhabens 2': (d) => splitText(view(d).projektName, 35, 95)[1],
      'Bezeichnung des Vorhabens 3': (d) => splitText(view(d).projektName, 35, 95)[2],
      'Name Projektleitung in Druckbuchstaben': (d) => view(d).projektleitung ?? '',
      'Name Lehrstuhlinhaber_in in Druckbuchstaben': (d) =>
        view(d).projektleitungIstLehrstuhlinhaber ? view(d).projektleitung ?? '' : '',
    },
  }
}
