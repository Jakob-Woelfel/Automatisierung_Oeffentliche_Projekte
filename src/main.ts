/**
 * Contract processing pipeline — entry point.
 *
 * Usage:
 *   npm start -- input/my_contract.pdf
 *   npx tsx src/main.ts input/my_contract.pdf
 *
 * Future deployment:
 *   Azure Function: import runPipeline() and call it from an HTTP/blob trigger
 *   Email trigger: call runPipeline() after downloading the attachment
 *   Batch mode: loop over files in input/ and call runPipeline() for each
 */

import path from 'path'
import fs from 'fs'
import { writeFile } from 'fs/promises'

import { extractText } from './pipeline/extract_text'
import { extractContractData } from './pipeline/extract_data'
import { validateContractData } from './pipeline/validate_data'
import { fillPdfTemplate } from './pipeline/fill_pdf'
import { generateEmailDraft } from './pipeline/generate_email'

const PDF_TEMPLATES: [string, string][] = [
  ['anzeige_drimi', 'pdf_templates/Anzeige-DriMi_Stand-Mai-2024.pdf'],
  ['erklaerung', 'pdf_templates/Erklaerung-zum-Forschungs--und-Drittmittelvorhaben_Stand-November-2024.pdf'],
]

function makeTimestamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  )
}

export async function runPipeline(inputPdf: string): Promise<{
  outputDir: string
  extractedJson: string
  filledPdfs: string[]
  emailDraft: string
}> {
  if (!fs.existsSync(inputPdf)) {
    throw new Error(`Input PDF not found: ${inputPdf}`)
  }

  const stem = path.basename(inputPdf, '.pdf')
  const outputDir = path.join('output', `${stem}_${makeTimestamp()}`)
  fs.mkdirSync(outputDir, { recursive: true })

  console.log(`\nProcessing: ${path.basename(inputPdf)}`)
  console.log(`Output dir: ${outputDir}\n`)

  console.log('[1/5] Extracting text from PDF...')
  const rawText = await extractText(inputPdf)

  console.log('[2/5] Sending to Open Web UI for structured extraction...')
  const rawJson = await extractContractData(rawText)

  console.log('[3/5] Validating extracted data...')
  const validated = validateContractData(rawJson)

  const jsonPath = path.join(outputDir, 'extracted_data.json')
  await writeFile(jsonPath, JSON.stringify(rawJson, null, 2), 'utf-8')
  console.log(`      Saved: ${jsonPath}`)

  console.log('[4/5] Filling PDF templates...')
  const filledPdfs: string[] = []
  for (const [name, templatePath] of PDF_TEMPLATES) {
    const outPdf = path.join(outputDir, `${name}_filled.pdf`)
    await fillPdfTemplate(templatePath, validated, outPdf)
    console.log(`      Saved: ${outPdf}`)
    filledPdfs.push(outPdf)
  }

  console.log('[5/5] Generating email draft...')
  const emailText = await generateEmailDraft(validated)
  const emailPath = path.join(outputDir, 'email_draft.txt')
  await writeFile(emailPath, emailText, 'utf-8')
  console.log(`      Saved: ${emailPath}`)

  console.log(`\nDone. Review the outputs in: ${outputDir}/\n`)

  return { outputDir, extractedJson: jsonPath, filledPdfs, emailDraft: emailPath }
}

if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.length < 1) {
    console.error('Usage: npm start -- <path-to-contract.pdf>')
    process.exit(1)
  }
  runPipeline(args[0]).catch((err: Error) => {
    console.error(err.message)
    process.exit(1)
  })
}
