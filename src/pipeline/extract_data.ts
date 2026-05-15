import OpenAI from 'openai'
import * as dotenv from 'dotenv'

dotenv.config()

// ── Configuration — edit these to change extraction behavior ──────────────────
const MODEL = 'gpt-4o-mini'

const EXTRACTION_PROMPT = `\
You are a precise document parser for German public project contracts
(Drittmittelverträge, Förderverträge, Zuwendungsbescheide).

Extract the following fields from the contract text and return ONLY valid JSON.
Rules:
- Do not invent missing information.
- Use null for any field that cannot be found.
- Dates: use ISO 8601 format (YYYY-MM-DD) if determinable, otherwise null.
- funding_amount: numeric value only (float), no currency symbol.
- Add field names you could not find to "missing_fields".
- Add a short note about confidence or ambiguous values to "confidence_notes".

Return exactly this JSON structure, nothing else:
{
  "project_name": "string or null",
  "contract_partner": "string or null",
  "organization": "string or null",
  "address": "string or null",
  "contact_person": "string or null",
  "email": "string or null",
  "funding_amount": number or null,
  "project_start_date": "YYYY-MM-DD or null",
  "project_end_date": "YYYY-MM-DD or null",
  "contract_reference": "string or null",
  "missing_fields": ["list of field names not found"],
  "confidence_notes": "string"
}`
// ─────────────────────────────────────────────────────────────────────────────

export async function extractContractData(text: string): Promise<Record<string, unknown>> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: EXTRACTION_PROMPT },
      { role: 'user', content: `Contract text:\n\n${text}` },
    ],
    temperature: 0,
  })

  return JSON.parse(response.choices[0].message.content!)
}
