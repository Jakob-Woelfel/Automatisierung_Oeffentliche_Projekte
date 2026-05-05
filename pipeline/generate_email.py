"""
Step 5: Generate a German email draft for the responsible case worker.

Uses OpenAI to produce a natural-sounding draft based on the extracted data.
Future extension: replace with a Jinja2 template for fully deterministic emails,
or maintain separate templates per document type.
"""

import os
from openai import OpenAI
from dotenv import load_dotenv
from schema.contract_schema import ContractData

load_dotenv()

MODEL = "gpt-4o-mini"

EMAIL_SYSTEM_PROMPT = (
    "Du bist ein Assistent für die Drittmittelverwaltung einer deutschen Hochschule. "
    "Erstelle einen höflichen, sachlichen Entwurf für eine interne E-Mail an den zuständigen "
    "Sachbearbeiter zur Anzeige eines neuen Drittmittelvorhabens. "
    "Halte die E-Mail kurz und professionell. Verwende förmliche Sprache (Sie-Form). "
    "Markiere fehlende oder unklare Informationen mit [BITTE ERGÄNZEN]."
)


def generate_email_draft(data: ContractData) -> str:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    project_summary = f"""
Projektname:       {data.project_name or '[unbekannt]'}
Drittmittelgeber:  {data.contract_partner or '[unbekannt]'}
Einrichtung:       {data.organization or '[unbekannt]'}
Projektleitung:    {data.contact_person or '[unbekannt]'}
Fördersumme:       {data.format_amount() or '[unbekannt]'}
Laufzeit:          {data.format_date('project_start_date') or '[unbekannt]'} bis {data.format_date('project_end_date') or '[unbekannt]'}
Förderkennzeichen: {data.contract_reference or '[unbekannt]'}
Fehlende Felder:   {', '.join(data.missing_fields) if data.missing_fields else 'keine'}
""".strip()

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": EMAIL_SYSTEM_PROMPT},
            {"role": "user", "content": f"Erstelle die E-Mail auf Basis dieser Projektdaten:\n\n{project_summary}"},
        ],
        temperature=0.3,
    )

    return response.choices[0].message.content
