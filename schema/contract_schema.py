"""
Pydantic schema for validated contract data.

To add new fields or change validation rules, edit this file.
Future extension: create separate schemas for different document types
(e.g. ServiceContract, GrantAgreement) and select them in extract_data.py.
"""

from typing import Optional, List
from datetime import date
from pydantic import BaseModel


class ContractData(BaseModel):
    project_name: Optional[str] = None
    contract_partner: Optional[str] = None       # Drittmittelgeber / Auftraggeber
    organization: Optional[str] = None           # Lehrstuhl / Einrichtung
    address: Optional[str] = None
    contact_person: Optional[str] = None         # Projektleitung
    email: Optional[str] = None
    funding_amount: Optional[float] = None
    project_start_date: Optional[date] = None
    project_end_date: Optional[date] = None
    contract_reference: Optional[str] = None     # Förderkennzeichen / Vertragsnummer
    missing_fields: List[str] = []
    confidence_notes: Optional[str] = None

    def format_date(self, field_name: str) -> str:
        value = getattr(self, field_name)
        if value is None:
            return ""
        return value.strftime("%d.%m.%Y")

    def format_amount(self) -> str:
        if self.funding_amount is None:
            return ""
        # German number format: 1.234,56 €
        formatted = f"{self.funding_amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        return f"{formatted} €"
