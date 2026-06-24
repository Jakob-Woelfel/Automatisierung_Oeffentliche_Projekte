/**
 * Generic LLM extraction step (the only AI step besides the email draft).
 *
 * The prompt and model come from the active CaseModule, so this function is
 * document-type-agnostic. We keep `response_format: json_object` but still parse
 * defensively: local models (Mistral) sometimes wrap JSON in ```json fences.
 */
import { makeClient, DEFAULT_MODEL } from './llm'

/** Strip Markdown code fences some models wrap JSON in before parsing. */
function parseJsonResponse(content: string): Record<string, unknown> {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
  return JSON.parse(cleaned)
}

export async function extractData(
  text: string,
  prompt: string,
  model: string = DEFAULT_MODEL
): Promise<Record<string, unknown>> {
  const client = makeClient()

  const response = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: `Document text:\n\n${text}` },
    ],
    temperature: 0,
  })

  return parseJsonResponse(response.choices[0].message.content!)
}
