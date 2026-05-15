/**
 * Standalone OpenAI connectivity test.
 * Run before main.ts to verify your API key works.
 * Usage: npm run api-connect
 */

import OpenAI from 'openai'
import * as dotenv from 'dotenv'

dotenv.config()

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

client.chat.completions
  .create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Schreibe ein Haiku über Automatisierung.' }],
  })
  .then((response) => {
    console.log(response.choices[0].message.content)
  })
  .catch((err: Error) => {
    console.error('Connection failed:', err.message)
    process.exit(1)
  })
