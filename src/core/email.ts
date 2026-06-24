/**
 * Generic email-draft step (AI).
 *
 * The system prompt and the data→summary projection come from the active case's
 * `email` config, so this stays document-type-agnostic. Optional recipient and
 * subject are prepended as header lines for the operator's convenience.
 */
import { makeClient, DEFAULT_MODEL } from './llm'
import type { CaseModule } from './types'

export async function generateEmail<T>(data: T, cfg: CaseModule<T>['email']): Promise<string> {
  const client = makeClient()
  const summary = cfg.buildSummary(data)

  const response = await client.chat.completions.create({
    model: cfg.model ?? DEFAULT_MODEL,
    messages: [
      { role: 'system', content: cfg.systemPrompt },
      { role: 'user', content: `Erstelle die E-Mail auf Basis dieser Daten:\n\n${summary}` },
    ],
    temperature: 0.3,
  })

  const body = response.choices[0].message.content!

  const header: string[] = []
  if (cfg.recipient) header.push(`An: ${cfg.recipient}`)
  if (cfg.subject) header.push(`Betreff: ${cfg.subject}`)
  return header.length > 0 ? `${header.join('\n')}\n\n${body}` : body
}
