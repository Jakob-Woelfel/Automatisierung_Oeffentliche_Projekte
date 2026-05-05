"""
Step 2: Send extracted text to OpenAI and receive structured JSON.

This is the only module that calls the AI for data extraction.
To change what is extracted or how: edit EXTRACTION_PROMPT or MODEL below.

Future extensions:
  - Swap to Azure OpenAI by changing client initialization
  - Add different prompts for different document types
  - Use GPT-4o with vision input for scanned documents
"""

import json
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# ── Configuration — edit these to change extraction behavior ──────────────────
MODEL = "gpt-4o-mini"

EXTRACTION_PROMPT = """
You are a precise document parser for German public project contracts
(Drittmittelverträge, Förderverträge, Zuwendungsbescheide).

Extract the following fields from the contract text and return ONLY valid JSON.
Rules:
- Do not invent missing information.
- Use null for any field that cannot be found.
- Dates: use ISO 8601 format (YYYY-MM-DD) if determinable, otherwise null.
- funding_amount: numeric value only (float), no currency symbol.
- Add field names you could not find to "missing_fields".
- Add a short note about confidence or ambiguous values to "confidence_notes".

Return exactly this JSON structure, nothing else:
{
  "project_name": "string or null",
  "contract_partner": "string or null",
  "organization": "string or null",
  "address": "string or null",
  "contact_person": "string or null",
  "email": "string or null",
  "funding_amount": number or null,
  "project_start_date": "YYYY-MM-DD or null",
  "project_end_date": "YYYY-MM-DD or null",
  "contract_reference": "string or null",
  "missing_fields": ["list of field names not found"],
  "confidence_notes": "string"
}
""".strip()
# ─────────────────────────────────────────────────────────────────────────────


def extract_contract_data(text: str) -> dict:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    response = client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": EXTRACTION_PROMPT},
            {"role": "user", "content": f"Contract text:\n\n{text}"},
        ],
        temperature=0,  # deterministic extraction
    )

    return json.loads(response.choices[0].message.content)
