"""
Contract processing pipeline — entry point.

Usage:
    python main.py <path-to-contract.pdf>

Pipeline steps:
    1. Extract text from the input PDF
    2. Send text to OpenAI → receive structured JSON
    3. Validate JSON against ContractData schema
    4. Fill both PDF templates with the validated data
    5. Generate a German email draft

All outputs land in output/<filename>_<timestamp>/

Future deployment:
    - Azure Function: import run_pipeline() and call it from an HTTP/blob trigger
    - Email trigger: call run_pipeline() after downloading the attachment
    - Batch mode: loop over files in input/ and call run_pipeline() for each
"""

import sys
import json
from pathlib import Path
from datetime import datetime

from pipeline.extract_text import extract_text
from pipeline.extract_data import extract_contract_data
from pipeline.validate_data import validate_contract_data
from pipeline.fill_pdf import fill_pdf_template
from pipeline.generate_email import generate_email_draft

PDF_TEMPLATES = [
    ("anzeige_drimi", "pdf_templates/Anzeige-DriMi_Stand-Mai-2024.pdf"),
    ("erklaerung",    "pdf_templates/Erklaerung-zum-Forschungs--und-Drittmittelvorhaben_Stand-November-2024.pdf"),
]


def run_pipeline(input_pdf: str) -> dict:
    input_path = Path(input_pdf)
    if not input_path.exists():
        raise FileNotFoundError(f"Input PDF not found: {input_pdf}")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path("output") / f"{input_path.stem}_{timestamp}"
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\nProcessing: {input_path.name}")
    print(f"Output dir: {output_dir}\n")

    print("[1/5] Extracting text from PDF...")
    raw_text = extract_text(str(input_path))

    print("[2/5] Sending to OpenAI for structured extraction...")
    raw_json = extract_contract_data(raw_text)

    print("[3/5] Validating extracted data...")
    validated = validate_contract_data(raw_json)

    json_path = output_dir / "extracted_data.json"
    json_path.write_text(json.dumps(raw_json, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"      Saved: {json_path}")

    print("[4/5] Filling PDF templates...")
    filled_pdfs = []
    for name, template_path in PDF_TEMPLATES:
        out_pdf = output_dir / f"{name}_filled.pdf"
        fill_pdf_template(template_path, validated, str(out_pdf))
        print(f"      Saved: {out_pdf}")
        filled_pdfs.append(str(out_pdf))

    print("[5/5] Generating email draft...")
    email_text = generate_email_draft(validated)
    email_path = output_dir / "email_draft.txt"
    email_path.write_text(email_text, encoding="utf-8")
    print(f"      Saved: {email_path}")

    print(f"\nDone. Review the outputs in: {output_dir}/\n")

    return {
        "output_dir": str(output_dir),
        "extracted_json": str(json_path),
        "filled_pdfs": filled_pdfs,
        "email_draft": str(email_path),
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python main.py <path-to-contract.pdf>")
        sys.exit(1)
    run_pipeline(sys.argv[1])
