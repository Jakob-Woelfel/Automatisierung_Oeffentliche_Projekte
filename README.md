# Automatisierung Öffentliche Projekte

Minimal TypeScript/Node.js pipeline for processing public project contract PDFs (Drittmittelverträge / Förderverträge).

## How it works

```
input PDF
  → [1] extract text          src/pipeline/extract_text.ts
  → [2] OpenAI extraction     src/pipeline/extract_data.ts
  → [3] schema validation     src/pipeline/validate_data.ts
  → [4] fill PDF templates    src/pipeline/fill_pdf.ts
  → [5] generate email draft  src/pipeline/generate_email.ts
  → output/
        extracted_data.json
        anzeige_drimi_filled.pdf
        erklaerung_filled.pdf
        email_draft.txt
```

The AI only handles steps 2 and 5. All other steps are deterministic TypeScript.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env and add your OpenAI API key
```

## Run

```bash
npm start -- input/my_contract.pdf
```

Outputs land in `output/<filename>_<timestamp>/`.

To test your OpenAI connection first:
```bash
npm run api-connect
```

## Where to change things

| What | File |
|------|------|
| OpenAI extraction prompt | `src/pipeline/extract_data.ts` → `EXTRACTION_PROMPT` |
| OpenAI model | `src/pipeline/extract_data.ts` → `MODEL` |
| Extracted fields (schema) | `src/schema/contract_schema.ts` → `ContractDataSchema` |
| PDF field mapping | `src/config/field_mapping.ts` |
| Email prompt / style | `src/pipeline/generate_email.ts` → `EMAIL_SYSTEM_PROMPT` |
| Which PDF templates to fill | `src/main.ts` → `PDF_TEMPLATES` |

## Project structure

```
.
├── src/
│   ├── main.ts                    # Entry point — run this
│   ├── api_connect.ts             # Standalone connection test
│   │
│   ├── pipeline/                  # One file per pipeline step
│   │   ├── extract_text.ts        # Step 1: PDF → raw text (pdf-parse)
│   │   ├── extract_data.ts        # Step 2: text → JSON via OpenAI
│   │   ├── validate_data.ts       # Step 3: JSON → validated Zod object
│   │   ├── fill_pdf.ts            # Step 4: fill PDF form fields (pdf-lib)
│   │   └── generate_email.ts      # Step 5: German email draft via OpenAI
│   │
│   ├── schema/
│   │   └── contract_schema.ts     # ContractData Zod schema + formatDate/formatAmount
│   │
│   └── config/
│       └── field_mapping.ts       # PDF field name → ContractData mapping
│
├── pdf_templates/             # Source PDF forms (read-only)
├── input/                     # Drop contract PDFs here
├── output/                    # Generated outputs (gitignored)
├── .env                       # Your API key (never commit this)
├── .env.example               # Safe template to commit
├── package.json
└── tsconfig.json
```

## Adding a new PDF template

1. Add a mapping dict in `src/config/field_mapping.ts` — values are either `keyof ContractData` strings or `(d: ContractData) => string` functions
2. Register it in `TEMPLATE_MAPPINGS` using the PDF filename stem as key
3. Add it to `PDF_TEMPLATES` in `src/main.ts`

## Adding a new document type (future)

1. Create a new Zod schema in `src/schema/`
2. Write a new extraction prompt in `src/pipeline/extract_data.ts`
3. Create new PDF templates and add field mappings in `src/config/`
4. Add the new templates to `PDF_TEMPLATES` in `src/main.ts`

## Scaling to Azure / email triggers

`src/main.ts` exports `runPipeline(inputPdf: string): Promise<{...}>` as a plain async function.
To deploy on Azure:

```typescript
// azure_function/index.ts
import { AzureFunction, Context } from '@azure/functions'
import { runPipeline } from '../src/main'

const blobTrigger: AzureFunction = async (context: Context): Promise<void> => {
  // Save blob to temp file, then:
  await runPipeline('/tmp/contract.pdf')
}

export default blobTrigger
```

For email triggers: download the attachment, save to a temp path, call `runPipeline()`.
For batch processing: loop over files in `input/` and call `runPipeline()` for each.

No changes to pipeline logic are needed — only the trigger wrapper changes.
