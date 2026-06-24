/**
 * Core contracts for the modular pipeline.
 *
 * The pipeline is generic: it knows nothing about any specific document type.
 * Each document type is described by a `CaseModule`, and each kind of output
 * artifact (a fillable PDF, an Excel workbook, …) is produced by a `Renderer`
 * looked up from the renderer registry. Adding a new case = add a CaseModule;
 * adding a new output format = add a Renderer. Neither touches the core.
 */
import type { z } from 'zod'

/**
 * Maps a PDF text-field name → either a key of the case's data object
 * (its string value is used) or a function computing the string to fill.
 */
export type FieldMapping<T> = Record<string, keyof T | ((d: T) => string)>

/**
 * Maps a PDF checkbox field name → whether it should be checked, either a
 * constant (many boxes are "always the same") or a predicate over the data.
 */
export type CheckboxMapping<T> = Record<string, boolean | ((d: T) => boolean)>

/** A single cell write for the excel-patch renderer. */
export interface CellEdit {
  /** Sheet display name as shown in Excel, e.g. 'Personalkosten'. */
  sheet: string
  /** A1-style cell reference, e.g. 'I21'. */
  ref: string
  /** Value to write. Numbers are written as numeric cells. */
  value: number | string
}

/** A produced output artifact, discriminated by `kind`. */
export type DocumentSpec<T> =
  | {
      kind: 'pdf-form'
      /** Output filename stem, e.g. 'anzeige_drimi' → anzeige_drimi_filled.pdf */
      name: string
      /** Path to the blank template PDF. */
      template: string
      mapping: FieldMapping<T>
      checkboxes?: CheckboxMapping<T>
    }
  | {
      kind: 'excel-patch'
      /** Output filename stem; keeps the template's extension (.xlsm/.xlsx). */
      name: string
      /** Path to the template workbook. */
      template: string
      /** Cells to write; the workbook recomputes its own formulas on open. */
      cells: (d: T, derived: Record<string, unknown>) => CellEdit[]
    }

/** Everything specific to one document type. */
export interface CaseModule<T> {
  /** Stable id used on the CLI (`--case=<id>`) and in the registry. */
  id: string
  /** Human-readable name for logs. */
  displayName: string
  /**
   * Zod schema used to validate the LLM extraction. Input type is `any` because
   * schemas use `.default(...)`, which makes their input fields optional while
   * the parsed output `T` has them required.
   */
  schema: z.ZodType<T, z.ZodTypeDef, any>
  /** LLM extraction config. */
  extraction: { prompt: string; model?: string }
  /** Optional deterministic (no-AI) calculation run after validation. */
  derive?: (data: T) => Record<string, unknown>
  /** The artifacts this case produces. */
  documents: DocumentSpec<T>[]
  /**
   * Optional: a subfolder (relative to the run's output dir) to nest all
   * outputs in, derived from the data — e.g. the Unterauftrag PR-Nummer.
   * Return null/undefined to write directly into the run's output dir.
   */
  outputSubdir?: (data: T) => string | null | undefined
  /** Email-draft config. */
  email: {
    systemPrompt: string
    buildSummary: (d: T) => string
    recipient?: string
    subject?: string
    model?: string
  }
}

/** Produces one artifact kind. Registered in core/renderers/index.ts. */
export interface Renderer {
  kind: DocumentSpec<unknown>['kind']
  render(
    spec: DocumentSpec<any>,
    data: any,
    derived: Record<string, unknown>,
    outPath: string
  ): Promise<void>
}
