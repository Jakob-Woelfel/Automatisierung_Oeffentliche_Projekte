"""
Step 1: Extract raw text from a contract PDF.

Uses pdfplumber for text extraction.
Future extension: for scanned PDFs (no text layer), add OCR here
(e.g. pytesseract or Azure Document Intelligence).
"""

import pdfplumber


def extract_text(pdf_path: str) -> str:
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text)

    if not pages:
        raise ValueError(
            f"No extractable text found in: {pdf_path}\n"
            "If this is a scanned PDF, OCR support needs to be added."
        )

    return "\n\n".join(pages)
