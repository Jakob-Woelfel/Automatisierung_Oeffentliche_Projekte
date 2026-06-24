/**
 * Deterministic calculation for the Unterauftrag case — NO AI.
 *
 * The user confirmed the only numbers we need are:
 *   - PT-Satz  : a fixed rate per Personentag (config constant below)
 *   - PT       : Projekttage, read from the contract
 *   - gesamtnetto : Gesamt-Nettosumme, read from the contract
 *
 * The UBT Kalkulations-Excel computes everything else via its own formulas; we
 * only feed it a few cells (see cells() in index.ts).
 */
import type { UnterauftragData } from './schema'

/** 1 Personentag = 10 Stunden. */
export const STUNDEN_PRO_PT = 10

/**
 * Fixed PT-Satz in EUR pro Personentag.
 *
 * TODO(user): the user said this is "festgelegt" but has not yet provided the
 * number. This is an explicit placeholder, NOT a guessed real rate — confirm
 * before a production run. `calcUnterauftrag` flags `ptSatzPlaceholder` while
 * this is 0 so the pipeline can warn.
 */
export const PT_SATZ = 0

export interface UnterauftragCalc {
  /** Stunden gesamt = PT × 10 — geht in Personalkosten!I21. */
  stunden: number
  /** Personalkosten = PT × PT_SATZ (informativ; die Excel rechnet selbst). */
  personalkosten: number
  /** Gesamt-Nettosumme aus dem Vertrag — wird in Gesamtkalkulation!H35 fixiert. */
  gesamtnetto: number
  /** true, solange PT_SATZ noch der Platzhalter (0) ist. */
  ptSatzPlaceholder: boolean
}

export function calcUnterauftrag(data: UnterauftragData): UnterauftragCalc {
  const pt = data.projekttage ?? 0
  const gesamtnetto = data.gesamtnetto ?? 0
  return {
    stunden: pt * STUNDEN_PRO_PT,
    personalkosten: pt * PT_SATZ,
    gesamtnetto,
    ptSatzPlaceholder: PT_SATZ === 0,
  }
}
