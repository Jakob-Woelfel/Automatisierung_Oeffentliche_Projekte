# Automatisierung Öffentliche Projekte

Minimal Python pipeline for processing public project contract PDFs (Drittmittelverträge / Förderverträge).

## How it works

```
input PDF
  → [1] extract text          pipeline/extract_text.py
  → [2] OpenAI extraction     pipeline/extract_data.py
  → [3] schema validation     pipeline/validate_data.py
  → [4] fill PDF templates    pipeline/fill_pdf.py
  → [5] generate email draft  pipeline/generate_email.py
  → output/
        extracted_data.json
        anzeige_drimi_filled.pdf
        erklaerung_filled.pdf
        email_draft.txt
```

The AI only handles steps 2 and 5. All other steps are deterministic Python.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your OpenAI API key
```

## Run

```bash
python main.py input/my_contract.pdf
```

Outputs land in `output/<filename>_<timestamp>/`.

To test your OpenAI connection first:
```bash
python api_connect.py
```

## Where to change things

| What | File |
|------|------|
| OpenAI extraction prompt | `pipeline/extract_data.py` → `EXTRACTION_PROMPT` |
| OpenAI model | `pipeline/extract_data.py` → `MODEL` |
| Extracted fields (schema) | `schema/contract_schema.py` → `ContractData` |
| PDF field mapping | `config/field_mapping.py` |
| Email prompt / style | `pipeline/generate_email.py` → `EMAIL_SYSTEM_PROMPT` |
| Which PDF templates to fill | `main.py` → `PDF_TEMPLATES` |

## Project structure

```
.
├── main.py                    # Entry point — run this
├── api_connect.py             # Standalone connection test
├── .env                       # Your API key (never commit this)
├── .env.example               # Safe template to commit
├── requirements.txt
│
├── pipeline/                  # One file per pipeline step
│   ├── extract_text.py        # Step 1: PDF → raw text
│   ├── extract_data.py        # Step 2: text → JSON via OpenAI
│   ├── validate_data.py       # Step 3: JSON → validated Pydantic object
│   ├── fill_pdf.py            # Step 4: fill PDF form fields
│   └── generate_email.py      # Step 5: German email draft via OpenAI
│
├── schema/
│   └── contract_schema.py     # ContractData Pydantic model
│
├── config/
│   └── field_mapping.py       # PDF field name → ContractData mapping
│
├── pdf_templates/             # Source PDF forms (read-only)
├── input/                     # Drop contract PDFs here
└── output/                    # Generated outputs (gitignored)
```

## Adding a new PDF template

1. Add a mapping dict in `config/field_mapping.py`
2. Register it in `TEMPLATE_MAPPINGS` using the PDF filename stem as key
3. Add it to `PDF_TEMPLATES` in `main.py`

## Adding a new document type (future)

1. Create a new schema in `schema/` (e.g. `service_contract_schema.py`)
2. Write a new extraction prompt in `pipeline/extract_data.py`
3. Create new PDF templates and add field mappings in `config/`
4. Add the new templates to `PDF_TEMPLATES` in `main.py`

## Scaling to Azure / email triggers

`main.py` exposes `run_pipeline(input_pdf: str) -> dict` as a plain function.
To deploy on Azure:

```python
# azure_function/__init__.py
import azure.functions as func
from main import run_pipeline

def main(blob: func.InputStream) -> None:
    # Save blob to temp file, then:
    run_pipeline("/tmp/contract.pdf")
```

For email triggers: download the attachment, save to a temp path, call `run_pipeline()`.
For batch processing: loop over files in `input/` and call `run_pipeline()` for each.

No changes to pipeline logic are needed — only the trigger wrapper changes.