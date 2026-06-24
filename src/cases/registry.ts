/**
 * Case registry: case id → CaseModule.
 *
 * To add a new automation, implement a CaseModule under src/cases/<id>/ and
 * register it here. Nothing else in the pipeline needs to change.
 */
import type { CaseModule } from '../core/types'
import { oeffentlichCase } from './oeffentlich'
import { unterauftragCase } from './unterauftrag'

/** Used when no `--case` is given, preserving the original behaviour. */
export const DEFAULT_CASE = 'oeffentlich'

const CASES: Record<string, CaseModule<any>> = {
  [oeffentlichCase.id]: oeffentlichCase,
  [unterauftragCase.id]: unterauftragCase,
}

export function resolveCase(id: string): CaseModule<any> {
  const found = CASES[id]
  if (!found) {
    throw new Error(`Unknown case '${id}'. Available: ${Object.keys(CASES).join(', ')}`)
  }
  return found
}

export function listCases(): string[] {
  return Object.keys(CASES)
}
