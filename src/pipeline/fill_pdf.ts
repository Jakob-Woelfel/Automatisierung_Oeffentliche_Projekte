import { PDFDocument } from 'pdf-lib'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import type { ContractData } from '../schema/contract_schema'
import { TEMPLATE_MAPPINGS } from '../config/field_mapping'

export async function fillPdfTemplate(
  templatePath: string,
  data: ContractData,
  outputPath: string
): Promise<void> {
  const stem = path.basename(templatePath, '.pdf')
  const mapping = TEMPLATE_MAPPINGS[stem]

  if (!mapping) {
    throw new Error(
      `No field mapping defined for template: '${stem}'\n` +
      'Add a mapping dict in src/config/field_mapping.ts and register it in TEMPLATE_MAPPINGS.'
    )
  }

  const templateBytes = await readFile(templatePath)
  const pdfDoc = await PDFDocument.load(templateBytes)
  const form = pdfDoc.getForm()

  for (const [fieldName, rule] of Object.entries(mapping)) {
    let value: string
    if (typeof rule === 'function') {
      value = rule(data)
    } else {
      const raw = data[rule]
      value = raw !== null && raw !== undefined ? String(raw) : ''
    }

    try {
      form.getTextField(fieldName).setText(value)
    } catch {
      // field not present in this PDF — skip
    }
  }

  await writeFile(outputPath, await pdfDoc.save())
}
