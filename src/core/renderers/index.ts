/**
 * Renderer registry: artifact `kind` → Renderer.
 *
 * To support a new output format, implement a Renderer and register it here.
 * Cases never import renderers directly; the pipeline looks them up by kind.
 */
import type { Renderer } from '../types'
import { pdfFormRenderer } from './pdf_form'
import { excelPatchRenderer } from './excel_patch'

const RENDERERS: Record<string, Renderer> = {
  [pdfFormRenderer.kind]: pdfFormRenderer,
  [excelPatchRenderer.kind]: excelPatchRenderer,
}

export function getRenderer(kind: string): Renderer {
  const renderer = RENDERERS[kind]
  if (!renderer) {
    throw new Error(
      `No renderer registered for document kind: '${kind}'. ` +
        'Register one in src/core/renderers/index.ts.'
    )
  }
  return renderer
}
