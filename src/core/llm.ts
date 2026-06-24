/**
 * Shared LLM client + config.
 *
 * The `openai` package is used purely as a generic OpenAI-compatible HTTP client
 * (aliased `LLMClient`) pointed at a self-hosted Open Web UI instance via its
 * Ollama-compatible `/ollama/v1` endpoint. No request goes to OpenAI.
 */
import LLMClient from 'openai'
import * as dotenv from 'dotenv'

dotenv.config()

/** Default model; overridable per case via `extraction.model` / `email.model`. */
export const DEFAULT_MODEL = 'mistral-small3.1:latest'

export function makeClient(): LLMClient {
  return new LLMClient({
    apiKey: process.env.OPENWEBUI_API_KEY,
    baseURL: process.env.OPENWEBUI_BASE_URL || 'https://fcb-wi.fit.fraunhofer.de/ollama/v1',
  })
}
