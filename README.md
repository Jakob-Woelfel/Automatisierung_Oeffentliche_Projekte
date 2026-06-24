# Automatisierung Öffentliche Projekte

Minimal TypeScript/Node.js pipeline for processing public project contract PDFs (Drittmittelverträge / Förderverträge).

Drive it from the **command line** (`pnpm start`) or a **local web interface** (`pnpm web`) — both run
the same pipeline, with all processing and secrets staying on your machine. See
[Weboberfläche](#weboberfläche-lokale-web-app).

## How it works

The pipeline is a **generic engine** driven by pluggable **case modules**. The engine
(`src/core/`) knows nothing about any specific document type; everything case-specific lives in a
`CaseModule` under `src/cases/<id>/`, and every kind of output artifact (a fillable PDF, an Excel
workbook, …) is produced by a `Renderer` looked up from a registry. Adding a new automation = add a
case; adding a new output format = add a renderer.

```
input PDF
  → [1] extract text (+ OCR)   src/pipeline/extract_text.ts
  → [2] LLM extraction         src/core/extract.ts    (prompt from the case)
  → [3] schema validation      src/core/validate.ts   (schema from the case)
  → [ ] derive (optional calc) case.derive            (deterministic, no AI)
  → [4] render documents       src/core/renderers/*   (case.documents)
  → [5] generate email draft   src/core/email.ts      (prompt from the case)
  → output/<stem>_<timestamp>/[<subfolder>]/
        extracted_data.json
        <document>_filled.pdf / <document>.xlsm …
        email_draft.txt
```

The AI only handles steps 2 and 5. All other steps are deterministic TypeScript.

Two cases ship today:

- **`oeffentlich`** (default) — Drittmittel-/Fördervertrag: fills Anzeige + Erklärung Drittmittel.
- **`unterauftrag`** — UBT wissenschaftliche Dienstleistung / subcontract: reuses the two Drittmittel
  forms, adds the *Erklärung zur steuerlichen Behandlung* PDF and the UBT *Kalkulations*-Excel, and
  nests outputs in a PR-Nummer subfolder. See [Cases](#cases).

The LLM runs on a self-hosted **Open Web UI** instance, reached through its
Ollama-compatible endpoint (`/ollama/v1`). Default model: `mistral-small3.1:latest`.
The `openai` npm package is used only as a generic OpenAI-compatible HTTP client
(imported as `LLMClient`) — no request ever goes to OpenAI's servers.

## Setup

This project uses **pnpm** (pinned via the `packageManager` field; enable with
`corepack enable pnpm` if you don't have it). Supply-chain hardening — blocked
dependency install scripts, a minimum release age, and strict peer deps — is
configured in `pnpm-workspace.yaml`.

```bash
pnpm install
cp .env.example .env
# Edit .env: add your Open Web UI API key (OPENWEBUI_API_KEY)
# and, if needed, override the endpoint via OPENWEBUI_BASE_URL
```

For scanned PDF support, also install Ghostscript:

```bash
brew install ghostscript
```

Step 1 automatically falls back to OCR (Tesseract.js, German language) when no embedded text is found. Ghostscript renders each page to a PNG; Tesseract reads it. Text-based PDFs work without Ghostscript.

## Run

```bash
# default case (Öffentliche Projekte)
pnpm start input/my_contract.pdf

# pick a case
pnpm start -- --case=unterauftrag input/my_subcontract.pdf

# run the calculation unit tests
pnpm test
```

Outputs land in `output/<filename>_<timestamp>/` (the `unterauftrag` case nests them in a
PR-Nummer subfolder).

To test your Open Web UI connection first:
```bash
pnpm api-connect
```

### Weboberfläche (lokale Web-App)

Statt der CLI lässt sich die Pipeline auch über eine schlichte Browser-Oberfläche bedienen:

```bash
pnpm web                 # dann http://localhost:3000 öffnen
PORT=4000 pnpm web       # anderer Port
```

PDF per Drag-&-Drop hochladen, Fall auswählen, „Verarbeiten" klicken — die extrahierten
Felder, der E-Mail-Entwurf und Download-Links zu den erzeugten Formularen erscheinen direkt
auf der Seite. Es entstehen dieselben `output/<filename>_<timestamp>/`-Ordner wie über die CLI.

Wichtig: Dies ist eine **lokale** Web-App. Der Browser spricht nur mit `localhost`; die gesamte
Verarbeitung, die `.env` (inkl. `OPENWEBUI_API_KEY`) und der LLM-Aufruf bleiben auf diesem
Rechner. Der Server ist bewusst abhängigkeitsfrei (nur Node-Bordmittel, `src/web/server.ts`) und
ein dünner Wrapper um `runPipeline()` — kein Express, nichts neu zu prüfen.

> Hinweis: GitHub Pages o. ä. scheidet aus, weil dort kein Node läuft und jedes ausgelieferte
> Geheimnis öffentlich wäre. Eine öffentliche Oberfläche bräuchte ein getrenntes Backend, das
> die `.env` hält — diese lokale App ist dafür die direkte Vorstufe.

## Where to change things

Everything case-specific lives in one folder per case, `src/cases/<id>/`:

| What | File |
|------|------|
| Extraction prompt / model | `src/cases/<id>/index.ts` → `extraction` |
| Extracted fields (schema) | `src/cases/<id>/schema.ts` |
| Which documents to produce | `src/cases/<id>/index.ts` → `documents` |
| PDF field mapping / checkboxes | the `DocumentSpec` in `src/cases/<id>/index.ts` (or `shared/drittmittel_docs.ts` for the reused forms) |
| Deterministic calculation | `src/cases/<id>/calc.ts` (+ `case.derive`) |
| Email prompt / recipient | `src/cases/<id>/index.ts` → `email` |
| Register a case | `src/cases/registry.ts` |
| LLM endpoint / API key / default model | `.env`, `src/core/llm.ts` |
| New output format (renderer) | `src/core/renderers/` + register in `renderers/index.ts` |

## Project structure

```
.
├── src/
│   ├── main.ts                    # CLI entry point (parses --case) + re-exports runPipeline
│   ├── api_connect.ts             # Standalone connection test
│   │
│   ├── core/                      # Generic, case-agnostic engine
│   │   ├── pipeline.ts            # Orchestration (runPipeline)
│   │   ├── types.ts               # CaseModule, DocumentSpec, Renderer, FieldMapping, CellEdit
│   │   ├── extract.ts             # Step 2: text → JSON via LLM (prompt from the case)
│   │   ├── validate.ts            # Step 3: JSON → validated Zod object (schema from the case)
│   │   ├── email.ts               # Step 5: email draft via LLM (prompt from the case)
│   │   ├── llm.ts                 # Shared Open Web UI client + default model
│   │   └── renderers/             # One renderer per artifact kind
│   │       ├── pdf_form.ts        #   'pdf-form'    — fill AcroForm PDFs (pdf-lib)
│   │       ├── excel_patch.ts     #   'excel-patch' — surgical .xlsm cell patch (fflate)
│   │       └── index.ts           #   kind → renderer registry
│   │
│   ├── cases/                     # One folder per document type
│   │   ├── registry.ts            # case id → CaseModule (+ DEFAULT_CASE)
│   │   ├── oeffentlich/           # Drittmittel-/Fördervertrag (default)
│   │   └── unterauftrag/          # UBT wiss. Dienstleistung (schema, calc, index, test)
│   │
│   ├── shared/                    # Reusable cross-case pieces
│   │   ├── format.ts              # formatDate / formatAmount / today
│   │   └── drittmittel_docs.ts    # Anzeige + Erklärung Drittmittel DocumentSpecs (via DrittmittelView)
│   │
│   └── pipeline/
│       └── extract_text.ts        # Step 1: PDF → raw text (pdf-parse, OCR fallback via Tesseract.js)
│
├── pdf_templates/             # Source PDF forms (read-only)
├── xlsx_templates/            # Source Excel workbooks (read-only)
├── input/                     # Drop contract PDFs here
├── output/                    # Generated outputs (gitignored)
├── .env / .env.example
├── package.json
├── pnpm-workspace.yaml         # pnpm settings + supply-chain hardening
├── pnpm-lock.yaml
└── tsconfig.json
```

## Cases

A **case** is a `CaseModule<T>` (`src/core/types.ts`): a schema, an extraction prompt, a list of
`documents` to produce, an optional `derive` (deterministic calc), an optional `outputSubdir`, and
an `email` config. The engine runs any case generically.

### `unterauftrag` (UBT wissenschaftliche Dienstleistung)

Reuses the shared Drittmittel forms via a `DrittmittelView`, and adds:

- **Erklärung zur steuerlichen Behandlung** (PDF) — mostly static checkboxes; `Inland/EU/Drittland`
  ankreuzen follows `partnerland`.
- **UBT Kalkulations-Excel** (`.xlsm`) — the workbook is structure-locked, formula-driven and
  macro-enabled, so we **do not** re-emit it. The `excel-patch` renderer surgically writes only a
  few cells inside the ZIP, preserves everything else (protection, formulas, form controls, macros),
  drops the stale `calcChain.xml`, and sets `fullCalcOnLoad` so Excel recomputes on open. Cells
  written: `Personalkosten!I21` = Stunden (PT × 10) and `Gesamtkalkulation!H35` = Gesamt-Nettosumme.

Only three numbers drive the calculation (`src/cases/unterauftrag/calc.ts`): the fixed **PT-Satz**
(config constant — currently a `TODO` placeholder), **PT** and **gesamtnetto** (both from the
contract). Overhead and Umsatzsteuer are set by the UBT Referat and are out of scope.

> Still `TODO` before a production run: the real PT-Satz, the exact `Daten zum Auftrag` input cells,
> verifying the `H35` derivation against a real sample, and tuning the extraction prompt on real
> (anonymised) subcontract PDFs.

## Adding a new case

1. `src/cases/<id>/schema.ts` — a Zod schema (`.nullable().default(null)` fields + `missing_fields`).
2. `src/cases/<id>/index.ts` — export a `CaseModule`: extraction prompt, `documents` (reuse
   `shared/drittmittel_docs.ts` where possible, add case-specific `DocumentSpec`s), optional
   `derive`/`outputSubdir`, and `email`.
3. Register it in `src/cases/registry.ts`.
4. Only if you need a **new output format**: add a `Renderer` in `src/core/renderers/` and register
   it in `renderers/index.ts`.

No changes to `src/core/` or `src/main.ts` are needed to add a case.

## Scaling to Azure / email triggers

`src/main.ts` re-exports `runPipeline(inputPdf: string, opts?: { case?: string }): Promise<RunResult>`
as a plain async function (defined in `src/core/pipeline.ts`). The optional `case` selects the
case module; omitting it uses the default (`oeffentlich`). To deploy on Azure:

```typescript
// azure_function/index.ts
import { AzureFunction, Context } from '@azure/functions'
import { runPipeline } from '../src/main'

const blobTrigger: AzureFunction = async (context: Context): Promise<void> => {
  // Save blob to temp file, then:
  await runPipeline('/tmp/contract.pdf', { case: 'unterauftrag' })
}

export default blobTrigger
```

For email triggers: download the attachment, save to a temp path, call `runPipeline()`.
For batch processing: loop over files in `input/` and call `runPipeline()` for each.

No changes to pipeline logic are needed — only the trigger wrapper changes.
