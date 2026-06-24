/**
 * Generic pipeline engine — orchestrates one run for a given case.
 *
 *   input PDF
 *     → extract text            (core/extract_text)
 *     → LLM extraction          (core/extract,  case.extraction.prompt)
 *     → schema validation       (core/validate, case.schema)
 *     → derive (optional calc)  (case.derive)
 *     → render documents        (core/renderers, case.documents)
 *     → email draft             (core/email,    case.email)
 *     → output/
 *
 * Nothing here is document-type specific: behaviour comes entirely from the
 * resolved CaseModule. Add a new automation by adding a case, not by editing this.
 */
import path from 'path'
import fs from 'fs'
import { writeFile } from 'fs/promises'

import { extractText } from './extract_text'
import { extractData } from './extract'
import { validateData } from './validate'
import { generateEmail } from './email'
import { getRenderer } from './renderers'
import { resolveCase, DEFAULT_CASE } from '../cases/registry'
import type { CaseModule, DocumentSpec } from './types'

function makeTimestamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  )
}

/** Filesystem-safe folder name from arbitrary text (e.g. a PR-Nummer). */
function sanitizeSegment(s: string): string {
  return s.trim().replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^_+|_+$/g, '') || 'unbenannt'
}

/** Output filename for a rendered document. */
function outputNameFor(spec: DocumentSpec<any>): string {
  if (spec.kind === 'pdf-form') return `${spec.name}_filled.pdf`
  return `${spec.name}${path.extname(spec.template)}` // excel-patch keeps .xlsm/.xlsx
}

export interface RunResult {
  outputDir: string
  extractedJson: string
  filledPdfs: string[]
  emailDraft: string
}

export async function runPipeline(
  inputPdf: string,
  opts: { case?: string } = {}
): Promise<RunResult> {
  // Resolve the case first so an unknown --case fails fast with a clear message.
  const caseModule = resolveCase(opts.case ?? DEFAULT_CASE) as CaseModule<any>

  if (!fs.existsSync(inputPdf)) {
    throw new Error(`Input PDF not found: ${inputPdf}`)
  }

  const stem = path.basename(inputPdf, '.pdf')
  const baseDir = path.join('output', `${stem}_${makeTimestamp()}`)
  fs.mkdirSync(baseDir, { recursive: true })

  console.log(`\nProcessing: ${path.basename(inputPdf)}  [case: ${caseModule.id}]`)
  console.log(`Output dir: ${baseDir}\n`)

  console.log('[1/5] Extracting text from PDF...')
  const rawText = await extractText(inputPdf)

  console.log('[2/5] Sending to Open Web UI for structured extraction...')
  const rawJson = await extractData(rawText, caseModule.extraction.prompt, caseModule.extraction.model)

  console.log('[3/5] Validating extracted data...')
  const validated = validateData(rawJson, caseModule.schema)

  // Optional deterministic calculation (no AI).
  const derived = caseModule.derive ? caseModule.derive(validated) : {}

  // Resolve the actual output dir (optionally nested, e.g. PR-Nummer folder).
  let outputDir = baseDir
  const sub = caseModule.outputSubdir?.(validated)
  if (sub) {
    outputDir = path.join(baseDir, sanitizeSegment(sub))
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const jsonPath = path.join(outputDir, 'extracted_data.json')
  await writeFile(jsonPath, JSON.stringify(rawJson, null, 2), 'utf-8')
  console.log(`      Saved: ${jsonPath}`)

  console.log('[4/5] Rendering documents...')
  const filledPdfs: string[] = []
  for (const spec of caseModule.documents) {
    const outPath = path.join(outputDir, outputNameFor(spec))
    await getRenderer(spec.kind).render(spec, validated, derived, outPath)
    console.log(`      Saved: ${outPath}`)
    filledPdfs.push(outPath)
  }

  console.log('[5/5] Generating email draft...')
  const emailText = await generateEmail(validated, caseModule.email)
  const emailPath = path.join(outputDir, 'email_draft.txt')
  await writeFile(emailPath, emailText, 'utf-8')
  console.log(`      Saved: ${emailPath}`)

  console.log(`\nDone. Review the outputs in: ${outputDir}/\n`)

  return { outputDir, extractedJson: jsonPath, filledPdfs, emailDraft: emailPath }
}
