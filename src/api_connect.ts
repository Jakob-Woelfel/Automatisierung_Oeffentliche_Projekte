/**
 * Standalone Open Web UI connectivity test.
 * Run before main.ts to verify your API key and endpoint work.
 * Usage: npm run api-connect
 */

import LLMClient from 'openai'
import * as dotenv from 'dotenv'

dotenv.config()

const client = new LLMClient({
  apiKey: process.env.OPENWEBUI_API_KEY,
  baseURL: process.env.OPENWEBUI_BASE_URL || 'https://fcb-wi.fit.fraunhofer.de/ollama/v1',
})

client.chat.completions
  .create({
    model: 'mistral-small3.1:latest',
    messages: [{ role: 'user', content: 'Schreibe ein Haiku über Automatisierung.' }],
  })
  .then((response) => {
    console.log(response.choices[0].message.content)
  })
  .catch((err: Error) => {
    console.error('Connection failed:', err.message)
    process.exit(1)
  })
