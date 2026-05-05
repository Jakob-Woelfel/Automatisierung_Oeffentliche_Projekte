"""
PDF form field → ContractData mapping for each template.

Key   = exact PDF field name (as read by PyMuPDF)
Value = ContractData attribute name (str) OR callable(ContractData) -> str

To support a new PDF template:
  1. Add a new dict below with the field mappings
  2. Register it in TEMPLATE_MAPPINGS using the PDF filename stem as key
"""

from datetime import date


def _today() -> str:
    return date.today().strftime("%d.%m.%Y")


# ── Anzeige-DriMi_Stand-Mai-2024.pdf ─────────────────────────────────────────

ANZEIGE_DRIMI_MAPPING = {
    "Datum":
        lambda d: _today(),
    "LehrstuhlEinrichtung":
        "organization",
    "Projektleitung":
        "contact_person",
    "Bezeichnung des Vorhabens_1":
        "project_name",
    "Name und Anschrift des Drittmittelgebers 1":
        lambda d: f"{d.contract_partner or ''}\n{d.address or ''}".strip(),
    "Beginn - Laufzeit des Vorhabens":
        lambda d: d.format_date("project_start_date"),
    "Ende - Laufzeit des Vorhabens":
        lambda d: d.format_date("project_end_date"),
    "Höhe und Zweckbestimmung der Mittel_1":
        lambda d: d.format_amount(),
}


# ── Erklaerung-zum-Forschungs--und-Drittmittelvorhaben_Stand-November-2024.pdf

ERKLAERUNG_MAPPING = {
    "Datum":
        lambda d: _today(),
    "LehrstuhlEinrichtung":
        "organization",
    "Name der Projektleitung":
        "contact_person",
    "Zuwendungssgeber":
        "contract_partner",
    "ggf Datum  Förderkennzeichen":
        "contract_reference",
    "FuEVertrag Datum":
        lambda d: d.format_date("project_start_date"),
    "Bezeichnung des Vorhabens 1":
        "project_name",
}


# ── Registry: filename stem → mapping dict ────────────────────────────────────

TEMPLATE_MAPPINGS = {
    "Anzeige-DriMi_Stand-Mai-2024": ANZEIGE_DRIMI_MAPPING,
    "Erklaerung-zum-Forschungs--und-Drittmittelvorhaben_Stand-November-2024": ERKLAERUNG_MAPPING,
}
