import pdfParse from 'pdf-parse'
import { readFile, writeFile, readdir, rm, mkdtemp } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import Tesseract from 'tesseract.js'

const execAsync = promisify(exec)

async function ocrPdf(buffer: Buffer): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'ocr-'))
  try {
    const pdfPath = join(tempDir, 'input.pdf')
    await writeFile(pdfPath, buffer)

    await execAsync(
      `gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r300 -sOutputFile="${tempDir}/page-%03d.png" "${pdfPath}"`
    )

    const pageFiles = (await readdir(tempDir))
      .filter((f) => f.startsWith('page-') && f.endsWith('.png'))
      .sort()

    const pageTexts = await Promise.all(
      pageFiles.map(async (file) => {
        const imgBuffer = await readFile(join(tempDir, file))
        const { data } = await Tesseract.recognize(imgBuffer, 'deu')
        return data.text
      })
    )

    return pageTexts.join('\n\n').trim()
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export async function extractText(pdfPath: string): Promise<string> {
  const buffer = await readFile(pdfPath)
  const data = await pdfParse(buffer)

  const text = data.text.trim()
  if (text) {
    return text
  }

  console.log(`No embedded text in ${pdfPath} — running OCR (this may take a moment)...`)
  const ocrText = await ocrPdf(buffer)

  if (!ocrText) {
    throw new Error(`No text could be extracted from: ${pdfPath}`)
  }

  return ocrText
}
