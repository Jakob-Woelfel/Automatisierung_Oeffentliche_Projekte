import pdfParse from 'pdf-parse'
import { readFile } from 'fs/promises'

export async function extractText(pdfPath: string): Promise<string> {
  const buffer = await readFile(pdfPath)
  const data = await pdfParse(buffer)

  const text = data.text.trim()
  if (!text) {
    throw new Error(
      `No extractable text found in: ${pdfPath}\n` +
      'If this is a scanned PDF, OCR support needs to be added.'
    )
  }

  return text
}
