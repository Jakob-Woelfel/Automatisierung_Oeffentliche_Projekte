/**
 * Renderer for `kind: 'pdf-form'` — fills an AcroForm PDF with pdf-lib.
 *
 * Text fields come from the spec's `mapping` (keyof data → its string value,
 * or a function → computed string). Checkboxes come from the optional
 * `checkboxes` map. Fields absent from the template are silently skipped, so a
 * mapping may safely list more fields than any single template contains.
 */
import { PDFDocument } from 'pdf-lib'
import { readFile, writeFile } from 'fs/promises'
import type { Renderer } from '../types'

export const pdfFormRenderer: Renderer = {
  kind: 'pdf-form',
  async render(spec, data, _derived, outPath) {
    if (spec.kind !== 'pdf-form') throw new Error('pdfFormRenderer got a non pdf-form spec')

    const templateBytes = await readFile(spec.template)
    const pdfDoc = await PDFDocument.load(templateBytes)
    const form = pdfDoc.getForm()

    for (const [fieldName, rule] of Object.entries(spec.mapping)) {
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
        // not a text field / not present in this PDF — skip
      }
    }

    for (const [fieldName, rule] of Object.entries(spec.checkboxes ?? {})) {
      const checked = typeof rule === 'function' ? rule(data) : rule
      try {
        const box = form.getCheckBox(fieldName)
        if (checked) box.check()
        else box.uncheck()
      } catch {
        // not a checkbox / not present in this PDF — skip
      }
    }

    await writeFile(outPath, await pdfDoc.save())
  },
}
