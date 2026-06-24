/**
 * Renderer for `kind: 'excel-patch'` — surgically writes a handful of cells into
 * a locked, macro-enabled .xlsm while leaving everything else intact.
 *
 * Why not exceljs? exceljs re-emits the workbook and drops VBA macros, and
 * struggles with sheet protection + form controls. Instead we treat the .xlsm
 * as the ZIP it is: we only rewrite the targeted `<c>` cell nodes inside the
 * relevant `xl/worksheets/sheetN.xml`, preserve the cell's style, set
 * `fullCalcOnLoad` so Excel recomputes all formulas on open, and drop the stale
 * `calcChain.xml`. Macros (vbaProject.bin), protection and styling are carried
 * over unchanged (content-identical; only the ZIP compression is regenerated).
 *
 * The sheet display name in each CellEdit is resolved to its sheetN.xml file via
 * xl/workbook.xml + xl/_rels/workbook.xml.rels.
 */
import { readFile, writeFile } from 'fs/promises'
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate'
import type { CellEdit, Renderer } from '../types'

/** 'I' → 9, 'AA' → 27 (1-based column index). */
function colToNum(letters: string): number {
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

function colOf(ref: string): number {
  return colToNum(ref.replace(/\d+/g, ''))
}

function rowOf(ref: string): string {
  return ref.replace(/\D+/g, '')
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Build a replacement <c> node, preserving the original style index `s`. */
function buildCell(ref: string, style: string | null, value: number | string): string {
  const sPart = style !== null ? ` s="${style}"` : ''
  if (typeof value === 'number') {
    return `<c r="${ref}"${sPart}><v>${value}</v></c>`
  }
  return `<c r="${ref}"${sPart} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

/** Apply one cell write to a worksheet XML string. */
function applyCellEdit(xml: string, ref: string, value: number | string): string {
  const row = rowOf(ref)
  const targetCol = colOf(ref)

  // Existing cell (self-closing or full). Capture its attributes to keep style.
  const cellRe = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`)
  const cellMatch = xml.match(cellRe)
  if (cellMatch) {
    const styleMatch = cellMatch[1].match(/\bs="(\d+)"/)
    return xml.replace(cellRe, buildCell(ref, styleMatch ? styleMatch[1] : null, value))
  }

  const newCell = buildCell(ref, null, value)

  // Cell absent — insert into its row in column order.
  const rowRe = new RegExp(`(<row r="${row}"[^>]*>)([\\s\\S]*?)(</row>)`)
  const rowMatch = xml.match(rowRe)
  if (rowMatch) {
    const inner = rowMatch[2]
    const refs = [...inner.matchAll(/<c r="([A-Z]+\d+)"/g)]
    let insertAt = inner.length
    for (const m of refs) {
      if (colOf(m[1]) > targetCol) {
        insertAt = m.index ?? inner.length
        break
      }
    }
    const newInner = inner.slice(0, insertAt) + newCell + inner.slice(insertAt)
    return xml.replace(rowRe, `${rowMatch[1]}${newInner}${rowMatch[3]}`)
  }

  // Row absent — insert a new <row> into <sheetData> in row order.
  const newRow = `<row r="${row}">${newCell}</row>`
  const rows = [...xml.matchAll(/<row r="(\d+)"/g)]
  for (const m of rows) {
    if (Number(m[1]) > Number(row)) {
      return xml.slice(0, m.index) + newRow + xml.slice(m.index)
    }
  }
  return xml.replace('</sheetData>', `${newRow}</sheetData>`)
}

/** Resolve sheet display name → 'xl/worksheets/sheetN.xml' inside the archive. */
function resolveSheetFiles(files: Record<string, Uint8Array>): Map<string, string> {
  const workbook = strFromU8(files['xl/workbook.xml'])
  const rels = strFromU8(files['xl/_rels/workbook.xml.rels'])

  const ridToTarget = new Map<string, string>()
  for (const m of rels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g)) {
    ridToTarget.set(m[1], m[2])
  }

  const nameToFile = new Map<string, string>()
  for (const m of workbook.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g)) {
    const target = ridToTarget.get(m[2])
    if (target) nameToFile.set(m[1], 'xl/' + target.replace(/^\//, '').replace(/^xl\//, ''))
  }
  return nameToFile
}

/** Remove the stale calcChain part and force a full recalculation on open. */
function forceRecalc(files: Record<string, Uint8Array>): void {
  if (files['xl/workbook.xml']) {
    let wb = strFromU8(files['xl/workbook.xml'])
    if (/<calcPr\b/.test(wb)) {
      if (!/fullCalcOnLoad=/.test(wb)) {
        wb = wb.replace(/<calcPr\b([^>]*?)\/>/, '<calcPr$1 fullCalcOnLoad="1"/>')
      }
    } else {
      wb = wb.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>')
    }
    files['xl/workbook.xml'] = strToU8(wb)
  }

  // Drop calcChain.xml and its references so Excel rebuilds it cleanly.
  delete files['xl/calcChain.xml']
  if (files['[Content_Types].xml']) {
    const ct = strFromU8(files['[Content_Types].xml']).replace(
      /<Override PartName="\/xl\/calcChain\.xml"[^>]*\/>/,
      ''
    )
    files['[Content_Types].xml'] = strToU8(ct)
  }
  if (files['xl/_rels/workbook.xml.rels']) {
    const rels = strFromU8(files['xl/_rels/workbook.xml.rels']).replace(
      /<Relationship[^>]*Target="calcChain\.xml"[^>]*\/>/,
      ''
    )
    files['xl/_rels/workbook.xml.rels'] = strToU8(rels)
  }
}

export const excelPatchRenderer: Renderer = {
  kind: 'excel-patch',
  async render(spec, data, derived, outPath) {
    if (spec.kind !== 'excel-patch') throw new Error('excelPatchRenderer got a non excel-patch spec')

    const edits: CellEdit[] = spec.cells(data, derived)
    const buf = await readFile(spec.template)
    const files = unzipSync(new Uint8Array(buf))

    const sheetFiles = resolveSheetFiles(files)

    // Group edits by sheet file, then apply.
    const bySheet = new Map<string, CellEdit[]>()
    for (const edit of edits) {
      const file = sheetFiles.get(edit.sheet)
      if (!file || !files[file]) {
        throw new Error(
          `excel-patch: sheet '${edit.sheet}' not found in ${spec.template}. ` +
            `Known sheets: ${[...sheetFiles.keys()].join(', ')}`
        )
      }
      const list = bySheet.get(file) ?? []
      list.push(edit)
      bySheet.set(file, list)
    }

    for (const [file, list] of bySheet) {
      let xml = strFromU8(files[file])
      for (const edit of list) xml = applyCellEdit(xml, edit.ref, edit.value)
      files[file] = strToU8(xml)
    }

    forceRecalc(files)

    const out = zipSync(files)
    await writeFile(outPath, out)
  },
}
