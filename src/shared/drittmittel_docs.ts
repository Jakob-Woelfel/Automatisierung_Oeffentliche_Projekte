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
      'Bezeichnung des Vorhabens_1': (d) => view(d).projektName ?? '',
      'Name und Anschrift des Drittmittelgebers 1': (d) => {
        const v = view(d)
        return [v.drittmittelgeber, v.anschrift].filter(Boolean).join('\n')
      },
      'Beginn - Laufzeit des Vorhabens': (d) => formatDate(view(d).beginn),
      'Ende - Laufzeit des Vorhabens': (d) => formatDate(view(d).ende),
      'Höhe und Zweckbestimmung der Mittel_1': (d) => formatAmount(view(d).betrag),
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
      Zuwendungssgeber: (d) => view(d).drittmittelgeber ?? '',
      'ggf Datum  Förderkennzeichen': (d) => view(d).kennzeichen ?? '',
      'FuEVertrag Datum': (d) => formatDate(view(d).beginn),
      'Bezeichnung des Vorhabens 1': (d) => view(d).projektName ?? '',
    },
  }
}
