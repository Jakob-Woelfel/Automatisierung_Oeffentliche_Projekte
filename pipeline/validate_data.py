"""
Step 3: Validate the raw JSON returned by OpenAI against ContractData schema.

Validation is fully deterministic — no AI involved.
Raises a clear error if the structure is wrong; prints a warning for missing fields.
"""

from pydantic import ValidationError
from schema.contract_schema import ContractData


def validate_contract_data(raw_json: dict) -> ContractData:
    try:
        data = ContractData(**raw_json)
    except ValidationError as e:
        raise ValueError(f"Extracted data failed schema validation:\n{e}") from e

    if data.missing_fields:
        print(f"      ! Fields not found by AI: {', '.join(data.missing_fields)}")

    return data
