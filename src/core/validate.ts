/**
 * Generic Zod validation step.
 *
 * Validates the raw LLM JSON against the active case's schema. By convention a
 * case schema exposes a `missing_fields: string[]` so partial extractions still
 * validate; if present, we surface it for the operator.
 */
import type { z } from 'zod'

export function validateData<T>(
  rawJson: Record<string, unknown>,
  schema: z.ZodType<T, z.ZodTypeDef, any>
): T {
  const result = schema.safeParse(rawJson)

  if (!result.success) {
    throw new Error(`Extracted data failed schema validation:\n${result.error.message}`)
  }

  const data = result.data as T
  const missing = (data as { missing_fields?: unknown }).missing_fields
  if (Array.isArray(missing) && missing.length > 0) {
    console.log(`      ! Fields not found by AI: ${missing.join(', ')}`)
  }

  return data
}
