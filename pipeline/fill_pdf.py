"""
Step 4: Fill a PDF template with validated contract data.

Uses PyMuPDF (fitz) to write into interactive form fields.
The mapping of which data goes into which field lives in config/field_mapping.py.

Future extensions:
  - Support checkbox fields (e.g. Auftragsforschung vs. Grundlagenforschung)
  - Handle non-form PDFs by inserting text at fixed coordinates
  - Add digital signature field population
"""

import fitz  # PyMuPDF
from pathlib import Path
from schema.contract_schema import ContractData
from config.field_mapping import TEMPLATE_MAPPINGS


def fill_pdf_template(template_path: str, data: ContractData, output_path: str) -> None:
    stem = Path(template_path).stem
    mapping = TEMPLATE_MAPPINGS.get(stem)

    if mapping is None:
        raise ValueError(
            f"No field mapping defined for template: '{stem}'\n"
            "Add a mapping dict in config/field_mapping.py and register it in TEMPLATE_MAPPINGS."
        )

    doc = fitz.open(template_path)

    for page in doc:
        for widget in page.widgets():
            field_name = widget.field_name
            if field_name not in mapping:
                continue

            rule = mapping[field_name]

            if callable(rule):
                value = rule(data)
            else:
                # rule is a ContractData attribute name
                value = getattr(data, rule, None)
                value = str(value) if value is not None else ""

            if widget.field_type_string == "Text":
                widget.field_value = value
                widget.update()

    doc.save(output_path, garbage=4, deflate=True)
    doc.close()
