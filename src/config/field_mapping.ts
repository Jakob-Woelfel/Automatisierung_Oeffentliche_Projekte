import type { ContractData } from '../schema/contract_schema'
import { formatDate, formatAmount } from '../schema/contract_schema'

type MappingRule = keyof ContractData | ((d: ContractData) => string)
export type TemplateMapping = Record<string, MappingRule>

function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`
}

// ── Anzeige-DriMi_Stand-Mai-2024.pdf ─────────────────────────────────────────

const ANZEIGE_DRIMI_MAPPING: TemplateMapping = {
  'Datum': () => today(),
  'LehrstuhlEinrichtung': 'organization',
  'Projektleitung': 'contact_person',
  'Bezeichnung des Vorhabens_1': 'project_name',
  'Name und Anschrift des Drittmittelgebers 1': (d) =>
    [d.contract_partner, d.address].filter(Boolean).join('\n'),
  'Beginn - Laufzeit des Vorhabens': (d) => formatDate(d.project_start_date),
  'Ende - Laufzeit des Vorhabens': (d) => formatDate(d.project_end_date),
  'Höhe und Zweckbestimmung der Mittel_1': (d) => formatAmount(d.funding_amount),
}

// ── Erklaerung-zum-Forschungs--und-Drittmittelvorhaben_Stand-November-2024.pdf

const ERKLAERUNG_MAPPING: TemplateMapping = {
  'Datum': () => today(),
  'LehrstuhlEinrichtung': 'organization',
  'Name der Projektleitung': 'contact_person',
  'Zuwendungssgeber': 'contract_partner',
  'ggf Datum  Förderkennzeichen': 'contract_reference',
  'FuEVertrag Datum': (d) => formatDate(d.project_start_date),
  'Bezeichnung des Vorhabens 1': 'project_name',
}

// ── Registry: PDF filename stem → mapping dict ────────────────────────────────

export const TEMPLATE_MAPPINGS: Record<string, TemplateMapping> = {
  'Anzeige-DriMi_Stand-Mai-2024': ANZEIGE_DRIMI_MAPPING,
  'Erklaerung-zum-Forschungs--und-Drittmittelvorhaben_Stand-November-2024': ERKLAERUNG_MAPPING,
}
