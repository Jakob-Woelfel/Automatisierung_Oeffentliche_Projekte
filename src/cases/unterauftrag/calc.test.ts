import { describe, it, expect } from 'vitest'
import { calcUnterauftrag, PT_SATZ, STUNDEN_PRO_PT } from './calc'
import { UnterauftragDataSchema } from './schema'

/** Build a valid UnterauftragData from a partial, via the schema defaults. */
function makeData(partial: Record<string, unknown>) {
  return UnterauftragDataSchema.parse(partial)
}

describe('calcUnterauftrag', () => {
  it('worked example: 20 PT, 50.000 € netto', () => {
    const data = makeData({ projekttage: 20, gesamtnetto: 50000 })
    const calc = calcUnterauftrag(data)

    // 1 PT = 10 h → 20 PT = 200 h (goes into Personalkosten!I21)
    expect(calc.stunden).toBe(200)
    // Personalkosten = PT × PT-Satz (Excel recomputes the rest itself)
    expect(calc.personalkosten).toBe(20 * PT_SATZ)
    // Gesamt-Nettosumme is pinned to the contract value (Gesamtkalkulation!H35)
    expect(calc.gesamtnetto).toBe(50000)
  })

  it('hours scale by STUNDEN_PRO_PT', () => {
    expect(calcUnterauftrag(makeData({ projekttage: 7 })).stunden).toBe(7 * STUNDEN_PRO_PT)
  })

  it('treats missing PT / netto as 0', () => {
    const calc = calcUnterauftrag(makeData({}))
    expect(calc.stunden).toBe(0)
    expect(calc.personalkosten).toBe(0)
    expect(calc.gesamtnetto).toBe(0)
  })

  it('flags the PT-Satz placeholder until a real rate is set', () => {
    // Guards against shipping with the unconfigured rate.
    expect(calcUnterauftrag(makeData({ projekttage: 1 })).ptSatzPlaceholder).toBe(PT_SATZ === 0)
  })
})
