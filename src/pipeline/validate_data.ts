import { ContractDataSchema, type ContractData } from '../schema/contract_schema'

export function validateContractData(rawJson: Record<string, unknown>): ContractData {
  const result = ContractDataSchema.safeParse(rawJson)

  if (!result.success) {
    throw new Error(`Extracted data failed schema validation:\n${result.error.message}`)
  }

  const data = result.data

  if (data.missing_fields.length > 0) {
    console.log(`      ! Fields not found by AI: ${data.missing_fields.join(', ')}`)
  }

  return data
}
